import os
from fastapi import APIRouter, HTTPException
from src.domain.schemas.monitor import (
    ServiceInfo, TaskInfo, MetricInfo, AlertInfo,
    ScaleRequest, ScaleResponse, ScaleConfig,
)
from src.infrastructure import docker_client as dc
from src.infrastructure.metrics_store import (
    get_metrics, get_alerts, get_config, update_config, EXCLUDED_SERVICES,
    HIDDEN_SERVICES, reset_low_cpu_cycles,
)

router = APIRouter(prefix="/monitor", tags=["monitor"])

STACK_NAME = os.getenv("SWARM_STACK_NAME", "pdc")


@router.get("/services", response_model=list[ServiceInfo])
def list_services():
    services = dc.get_stack_services(STACK_NAME)
    result = []
    for svc in services:
        short = svc.name.replace(f"{STACK_NAME}_", "")
        if short in HIDDEN_SERVICES:
            continue
        spec = svc.attrs.get("Spec", {})
        mode = spec.get("Mode", {})
        replicas_desired = mode.get("Replicated", {}).get("Replicas", 0)
        tasks = svc.tasks(filters={"desired-state": "running"})
        replicas_running = sum(1 for t in tasks if t["Status"]["State"] == "running")

        task_infos = [
            TaskInfo(
                id=t["ID"][:12],
                state=t["Status"]["State"],
                node=t.get("NodeID", "")[:8],
                updated_at=t["UpdatedAt"],
            )
            for t in tasks
        ]

        image = spec.get("TaskTemplate", {}).get("ContainerSpec", {}).get("Image", "")

        endpoint_ports = svc.attrs.get("Endpoint", {}).get("Ports", [])
        ports = [
            f"{p['PublishedPort']}:{p['TargetPort']}" if p.get("PublishedPort")
            else str(p["TargetPort"])
            for p in endpoint_ports
        ]

        result.append(ServiceInfo(
            name=short,
            replicas_running=replicas_running,
            replicas_desired=replicas_desired,
            image=image,
            ports=ports,
            tasks=task_infos,
        ))
    return result


@router.get("/metrics", response_model=list[MetricInfo])
def list_metrics():
    return [m for m in get_metrics() if m.service_name not in HIDDEN_SERVICES]


@router.post("/scale", response_model=ScaleResponse)
def scale_service(request: ScaleRequest):
    config = get_config()
    short_name = request.service_name.replace(f"{STACK_NAME}_", "")

    if short_name in EXCLUDED_SERVICES:
        raise HTTPException(
            status_code=403,
            detail=f"El servicio {short_name} no puede ser escalado"
        )
    if request.replicas < config.min_replicas:
        raise HTTPException(
            status_code=400,
            detail=f"Mínimo de réplicas: {config.min_replicas}"
        )
    if request.replicas > config.max_replicas:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo de réplicas: {config.max_replicas}"
        )

    # Obtener réplicas actuales
    full_name = f"{STACK_NAME}_{short_name}"
    services = dc.get_stack_services(STACK_NAME)
    current_service = next(
        (s for s in services if s.name == full_name), None
    )
    if not current_service:
        raise HTTPException(status_code=404, detail=f"Servicio no encontrado: {short_name}")

    old_replicas = current_service.attrs["Spec"]["Mode"]["Replicated"]["Replicas"]
    dc.scale_service(full_name, request.replicas)

    # Escala manual → reset del contador de ciclos de bajo CPU para este servicio.
    # Sin esto, si el servicio estaba idle, el auto-scaler revertía a 1 réplica en el
    # siguiente ciclo (30 s) porque _low_cpu_cycles ya había acumulado los 10 ciclos.
    reset_low_cpu_cycles(short_name)

    return ScaleResponse(
        service_name=short_name,
        old_replicas=old_replicas,
        new_replicas=request.replicas,
    )


@router.get("/alerts", response_model=list[AlertInfo])
def list_alerts():
    return get_alerts()


@router.get("/config", response_model=ScaleConfig)
def get_scale_config():
    return get_config()


@router.put("/config", response_model=ScaleConfig)
def update_scale_config(new_config: ScaleConfig):
    return update_config(new_config)
