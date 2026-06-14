from unittest.mock import patch


def test_health_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_health_fields_present(client):
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["service"] == "ms-ingestion"
    assert "chroma_connected" in data


def test_health_chroma_connected_true(client):
    """Con ChromaDB disponible, chroma_connected debe ser True."""
    data = client.get("/health").json()
    assert data["chroma_connected"] is True


def test_health_chroma_connected_false(client):
    """Con ChromaDB caído, el endpoint sigue respondiendo 200 pero informa el estado."""
    with patch("src.main.chroma_health", return_value=False):
        res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["chroma_connected"] is False
