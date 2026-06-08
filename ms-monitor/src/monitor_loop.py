import asyncio
import os
from src.infrastructure import docker_client as dc
from src.infrastructure.metrics_store import (
    update_metric, add_alert, get_config,
    increment_low_cpu_cycles, reset_low_cpu_cycles, EXCLUDED_SERVICES,
    check_and_update_restart_count,
)
from src.domain.schemas.monitor import MetricInfo


STACK_NAME = os.getenv("SWARM_STACK_NAME", "pdc")
LOOP_INTERVAL = 30  # segundos entre cada ciclo de monitoreo


def _calculate_cpu_percent(stats: dict) -> float:
    """Calcula el % de CPU de un contenedor a partir de docker stats (un snapshot)."""
    try:
        cpu_delta = (
            stats["cpu_stats"]["cpu_usage"]["total_usage"]
            - stats["precpu_stats"]["cpu_usage"]["total_usage"]
        )
        system_delta = (
            stats["cpu_stats"]["system_cpu_usage"]
            - stats["precpu_stats"]["system_cpu_usage"]
        )
        num_cpus = stats["cpu_stats"].get("online_cpus", 1)
        if system_delta > 0:
            return (cpu_delta / system_delta) * num_cpus * 100.0
    except (KeyError, ZeroDivisionError):
        pass
    return 0.0


def _calculate_memory_mb(stats: dict) -> float:
    try:
        usage = stats["memory_stats"]["usage"]
        cache = stats["memory_stats"].get("stats", {}).get("cache", 0)
        return (usage - cache) / (1024 * 1024)
    except (KeyError, ZeroDivisionError):
        return 0.0


async def monitor_loop():
    """Loop principal de monitoreo — corre como tarea asyncio en background."""
    await asyncio.sleep(10)  # Espera inicial para que el stack levante

    while True:
        try:
            _run_one_cycle()
        except Exception as exc:
            add_alert("system", "monitor_error", str(exc))
        await asyncio.sleep(LOOP_INTERVAL)


def _run_one_cycle():
    config = get_config()
    services = dc.get_stack_services(STACK_NAME)

    for service in services:
        service_name = service.name.replace(f"{STACK_NAME}_", "")
        spec = service.attrs.get("Spec", {})
        mode = spec.get("Mode", {})

        replicas_desired = mode.get("Replicated", {}).get("Replicas", 0)
        tasks = service.tasks(filters={"desired-state": "running"})
        replicas_running = sum(1 for t in tasks if t["Status"]["State"] == "running")

        # Detectar servicio caído
        if replicas_desired > 0 and replicas_running == 0:
            add_alert(service_name, "service_down",
                      f"0/{replicas_desired} réplicas activas")

        # Contar tareas fallidas (acumulado de por vida del servicio).
        # Comparamos con el ciclo anterior para detectar nuevos reinicios.
        all_tasks = service.tasks()
        restart_count = sum(1 for t in all_tasks if t["Status"]["State"] == "failed")

        # Recopilar métricas de CPU/RAM de cada tarea corriendo
        cpu_values = []
        total_memory = 0.0

        for task in tasks:
            if task["Status"]["State"] != "running":
                continue
            container_id = task.get("Status", {}).get("ContainerStatus", {}).get("ContainerID", "")
            if container_id:
                stats = dc.get_container_stats(container_id)
                if stats:
                    cpu_values.append(_calculate_cpu_percent(stats))
                    total_memory += _calculate_memory_mb(stats)

        cpu_avg = sum(cpu_values) / len(cpu_values) if cpu_values else 0.0

        update_metric(MetricInfo(
            service_name=service_name,
            cpu_percent=round(cpu_avg, 2),
            memory_mb=round(total_memory, 1),
            restart_count=restart_count,
        ))

        # Alerta si hubo nuevos reinicios desde el último ciclo
        if check_and_update_restart_count(service_name, restart_count):
            add_alert(service_name, "container_restart",
                      f"Tareas fallidas: {restart_count} (incremento detectado)")

        # No aplicar auto-scaling a servicios excluidos
        if service_name in EXCLUDED_SERVICES:
            continue

        # Regla de scale-up
        if cpu_avg > config.scale_up_cpu_threshold:
            if replicas_desired < config.max_replicas:
                new_replicas = replicas_desired + 1
                dc.scale_service(service.name, new_replicas)
                add_alert(service_name, "scale_up",
                          f"CPU {cpu_avg:.1f}% > {config.scale_up_cpu_threshold}%",
                          old_value=replicas_desired, new_value=new_replicas)
            reset_low_cpu_cycles(service_name)
            continue

        # Regla de scale-down (requiere N ciclos consecutivos por debajo del umbral)
        if cpu_avg < config.scale_down_cpu_threshold:
            cycles = increment_low_cpu_cycles(service_name)
            # LOOP_INTERVAL en segundos → convertir a ciclos necesarios
            cycles_needed = max(1, int(config.scale_down_delay_minutes * 60 / LOOP_INTERVAL))
            if cycles >= cycles_needed and replicas_desired > config.min_replicas:
                new_replicas = replicas_desired - 1
                dc.scale_service(service.name, new_replicas)
                add_alert(service_name, "scale_down",
                          f"CPU {cpu_avg:.1f}% < {config.scale_down_cpu_threshold}% por {config.scale_down_delay_minutes} min",
                          old_value=replicas_desired, new_value=new_replicas)
                reset_low_cpu_cycles(service_name)
        else:
            reset_low_cpu_cycles(service_name)
