import os
import docker
from docker.errors import DockerException
from typing import Optional


_client: Optional[docker.DockerClient] = None


def get_docker_client() -> docker.DockerClient:
    global _client
    if _client is None:
        socket_path = os.getenv("DOCKER_SOCKET", "/var/run/docker.sock")
        _client = docker.DockerClient(base_url=f"unix://{socket_path}")
    return _client


def get_stack_services(stack_name: str) -> list:
    client = get_docker_client()
    return client.services.list(
        filters={"label": f"com.docker.stack.namespace={stack_name}"}
    )


def scale_service(service_name: str, replicas: int) -> None:
    client = get_docker_client()
    services = client.services.list(filters={"name": service_name})
    if not services:
        raise ValueError(f"Servicio no encontrado: {service_name}")
    service = services[0]
    mode = service.attrs["Spec"]["Mode"]
    if "Replicated" not in mode:
        raise ValueError(f"El servicio {service_name} no es de tipo Replicated")
    service.scale(replicas)


def get_container_stats(container_id: str) -> dict:
    client = get_docker_client()
    try:
        container = client.containers.get(container_id)
        return container.stats(stream=False)
    except Exception:
        return {}


def is_swarm_active() -> bool:
    try:
        client = get_docker_client()
        info = client.info()
        return info.get("Swarm", {}).get("LocalNodeState") == "active"
    except DockerException:
        return False
