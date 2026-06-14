from unittest.mock import patch


def test_health_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_health_fields(client):
    data = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["service"] == "ms-monitor"
    assert "swarm_active" in data
    assert "services_count" in data


def test_health_swarm_active(client):
    """Con is_swarm_active=True el campo refleja True."""
    data = client.get("/health").json()
    assert data["swarm_active"] is True


def test_health_swarm_inactive(client):
    """Con Swarm inactivo, el endpoint sigue respondiendo 200 pero informa el estado."""
    with patch("src.main.is_swarm_active", return_value=False):
        res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["swarm_active"] is False
    assert res.json()["services_count"] == 0
