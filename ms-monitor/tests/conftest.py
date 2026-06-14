import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture(scope="module")
def client():
    # monitor_loop es AsyncMock: al llamarlo devuelve una corutina que completa
    # inmediatamente, evitando que el loop de monitoreo real corra en tests.
    # is_swarm_active y get_stack_services se parchean para evitar la conexión
    # al socket de Docker (/var/run/docker.sock) que no existe en CI.
    with (
        patch("src.main.monitor_loop", new_callable=AsyncMock),
        patch("src.main.is_swarm_active", return_value=True),
        patch("src.main.get_stack_services", return_value=[]),
    ):
        with TestClient(app) as c:
            yield c
