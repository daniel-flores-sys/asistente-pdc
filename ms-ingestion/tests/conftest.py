import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from src.main import app


@pytest.fixture(scope="module")
def client():
    # Mockeamos init_pool/close_pool para no necesitar PostgreSQL real,
    # y chroma_health para no necesitar ChromaDB real.
    # Se parchea donde se USAnlos nombres (src.main), no donde se definen.
    with (
        patch("src.main.init_pool", new_callable=AsyncMock),
        patch("src.main.close_pool", new_callable=AsyncMock),
        patch("src.main.chroma_health", return_value=True),
    ):
        with TestClient(app) as c:
            yield c
