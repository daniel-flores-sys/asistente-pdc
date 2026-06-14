from collections import deque
from datetime import datetime
from src.domain.schemas.monitor import AlertInfo, MetricInfo, ScaleConfig
import os


# Estado en memoria — no persiste entre reinicios del contenedor
_alerts: deque[AlertInfo] = deque(maxlen=200)
_metrics: dict[str, MetricInfo] = {}

# Contador para regla de scale-down: cuántos ciclos consecutivos por debajo del umbral
_low_cpu_cycles: dict[str, int] = {}

# Tracking de reinicios para detectar incrementos entre ciclos
_prev_restart_counts: dict[str, int] = {}

# Configuración mutable desde el endpoint PUT /monitor/config
_config = ScaleConfig(
    scale_up_cpu_threshold=float(os.getenv("SCALE_UP_CPU_THRESHOLD", "70")),
    scale_down_cpu_threshold=float(os.getenv("SCALE_DOWN_CPU_THRESHOLD", "20")),
    scale_down_delay_minutes=int(os.getenv("SCALE_DOWN_DELAY_MINUTES", "5")),
    max_replicas=int(os.getenv("MAX_REPLICAS", "5")),
    min_replicas=int(os.getenv("MIN_REPLICAS", "1")),
)

# Servicios que nunca se escalan automáticamente
EXCLUDED_SERVICES = set(
    os.getenv("EXCLUDED_SERVICES", "ms-monitor,postgres,chromadb").split(",")
)

# Servicios que no se muestran en el panel de monitoreo (BDs — no tienen réplicas dinámicas)
HIDDEN_SERVICES = set(
    os.getenv("HIDDEN_SERVICES", "postgres,chromadb").split(",")
)


def get_config() -> ScaleConfig:
    return _config


def update_config(new_config: ScaleConfig) -> ScaleConfig:
    global _config
    _config = new_config
    return _config


def update_metric(metric: MetricInfo) -> None:
    _metrics[metric.service_name] = metric


def get_metrics() -> list[MetricInfo]:
    return list(_metrics.values())


def add_alert(service: str, event: str, details: str,
              old_value: int | None = None, new_value: int | None = None) -> None:
    _alerts.append(AlertInfo(
        timestamp=datetime.utcnow().isoformat() + "Z",
        service=service,
        event=event,
        details=details,
        old_value=old_value,
        new_value=new_value,
    ))


def get_alerts() -> list[AlertInfo]:
    return list(reversed(_alerts))


def increment_low_cpu_cycles(service_name: str) -> int:
    _low_cpu_cycles[service_name] = _low_cpu_cycles.get(service_name, 0) + 1
    return _low_cpu_cycles[service_name]


def reset_low_cpu_cycles(service_name: str) -> None:
    _low_cpu_cycles.pop(service_name, None)


def check_and_update_restart_count(service_name: str, new_count: int) -> bool:
    """Devuelve True si el conteo de reinicios aumentó respecto al ciclo anterior."""
    prev = _prev_restart_counts.get(service_name)
    _prev_restart_counts[service_name] = new_count
    if prev is None:
        return False  # Primera ejecución: no alertar, solo establecer baseline
    return new_count > prev
