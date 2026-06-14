def test_health_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_health_status_ok(client):
    data = res = client.get("/health").json()
    assert data["status"] == "ok"
    assert data["service"] == "ms-ai-generator"
