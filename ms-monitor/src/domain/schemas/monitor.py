from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TaskInfo(BaseModel):
    id: str
    state: str
    node: Optional[str] = None
    updated_at: Optional[str] = None


class ServiceInfo(BaseModel):
    name: str
    replicas_running: int
    replicas_desired: int
    image: str
    ports: list[str] = []
    tasks: list[TaskInfo] = []


class MetricInfo(BaseModel):
    service_name: str
    cpu_percent: float
    memory_mb: float
    restart_count: int


class AlertInfo(BaseModel):
    timestamp: str
    service: str
    event: str      # 'scale_up' | 'scale_down' | 'container_restart' | 'service_down'
    details: str
    old_value: Optional[int] = None
    new_value: Optional[int] = None


class ScaleRequest(BaseModel):
    service_name: str
    replicas: int = Field(ge=1, le=20)


class ScaleResponse(BaseModel):
    service_name: str
    old_replicas: int
    new_replicas: int


class ScaleConfig(BaseModel):
    scale_up_cpu_threshold: float = 70.0
    scale_down_cpu_threshold: float = 20.0
    scale_down_delay_minutes: int = 5
    max_replicas: int = 5
    min_replicas: int = 1
