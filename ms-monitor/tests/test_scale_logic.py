from unittest.mock import patch, MagicMock


def _make_mock_service(name: str, replicas: int) -> MagicMock:
    """Construye un objeto servicio Docker simulado para las pruebas de scale."""
    svc = MagicMock()
    svc.name = f"pdc_{name}"
    svc.attrs = {"Spec": {"Mode": {"Replicated": {"Replicas": replicas}}}}
    return svc


def test_scale_zero_replicas_rejected(client):
    """replicas=0 viola la restricción ge=1 del schema — Pydantic devuelve 422."""
    res = client.post("/monitor/scale", json={"service_name": "ms-ai-generator", "replicas": 0})
    assert res.status_code == 422


def test_scale_above_max_returns_400(client):
    """replicas=6 supera max_replicas=5 (default), debe devolver 400."""
    res = client.post("/monitor/scale", json={"service_name": "ms-ai-generator", "replicas": 6})
    assert res.status_code == 400


def test_scale_excluded_service_returns_403(client):
    """postgres está en EXCLUDED_SERVICES y no puede escalarse manualmente."""
    res = client.post("/monitor/scale", json={"service_name": "postgres", "replicas": 2})
    assert res.status_code == 403


def test_scale_nonexistent_service_returns_404(client):
    """Si el servicio no existe en el Swarm, debe devolver 404."""
    with patch("src.application.routes.monitor.dc.get_stack_services", return_value=[]):
        res = client.post("/monitor/scale", json={"service_name": "ms-ai-generator", "replicas": 2})
    assert res.status_code == 404


def test_scale_valid_request_succeeds(client):
    """Un request válido con servicio existente debe devolver 200 con old/new replicas."""
    mock_svc = _make_mock_service("ms-ai-generator", 1)
    with (
        patch("src.application.routes.monitor.dc.get_stack_services", return_value=[mock_svc]),
        patch("src.application.routes.monitor.dc.scale_service"),
        patch("src.application.routes.monitor.reset_low_cpu_cycles"),
    ):
        res = client.post("/monitor/scale", json={"service_name": "ms-ai-generator", "replicas": 2})
    assert res.status_code == 200
    data = res.json()
    assert data["service_name"] == "ms-ai-generator"
    assert data["old_replicas"] == 1
    assert data["new_replicas"] == 2
