import pytest
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture(scope="module")
def client():
    # TestClient inicia la app sin lifespan complejo — ms-ai-generator no tiene lifespan
    with TestClient(app) as c:
        yield c
