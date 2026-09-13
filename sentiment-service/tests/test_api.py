"""End-to-end tests through the real FastAPI app.

These run without any ONNX model present, which is the degraded path — that is
deliberate: the fallback is the behaviour most likely to be silently broken, so
it is the one that must be covered in CI where no 400MB model can live.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_degraded_without_models(client):
    body = client.get("/health").json()
    assert body["status"] == "degraded"
    assert body["onnx_available"] is False
    # VADER is always listed so an operator can see what will actually score.
    assert any(m["name"] == "vader" for m in body["models"])


def test_scores_a_batch_and_echoes_ids(client):
    body = client.post(
        "/score",
        json={
            "items": [
                {"id": "a", "text": "Profits surged well past analyst expectations", "source_type": "news"},
                {"id": "b", "text": "The company collapsed into a disastrous bankruptcy", "source_type": "news"},
            ]
        },
    ).json()

    results = {r["id"]: r for r in body["results"]}
    assert set(results) == {"a", "b"}
    assert results["a"]["score"] > 0
    assert results["a"]["label"] == "positive"
    assert results["b"]["score"] < 0
    assert results["b"]["label"] == "negative"


def test_result_names_the_model_that_actually_scored(client):
    body = client.post(
        "/score", json={"items": [{"id": "x", "text": "markets rallied", "source_type": "news"}]}
    ).json()
    result = body["results"][0]
    # With no ONNX model loaded the honest answer is vader, not finbert.
    assert result["model"] == "vader"
    assert result["confidence"] is None
    # Not "degraded": nothing failed, VADER is simply the configured scorer here.
    assert result["degraded"] is False


def test_every_source_type_is_routable(client):
    items = [
        {"id": st, "text": "shares jumped on strong guidance", "source_type": st}
        for st in ("news", "social", "forum", "filing", "derived")
    ]
    body = client.post("/score", json={"items": items}).json()
    assert len(body["results"]) == len(items)


def test_empty_batch_is_not_an_error(client):
    assert client.post("/score", json={"items": []}).json() == {"results": []}


def test_oversized_batch_is_rejected(client):
    items = [{"id": str(i), "text": "x", "source_type": "news"} for i in range(65)]
    response = client.post("/score", json={"items": items})
    assert response.status_code == 413


def test_rejects_malformed_items(client):
    # Empty text and an unknown source_type must both 422 rather than be
    # silently coerced into a neutral score.
    assert client.post("/score", json={"items": [{"id": "a", "text": ""}]}).status_code == 422
    assert (
        client.post(
            "/score", json={"items": [{"id": "a", "text": "hi", "source_type": "telepathy"}]}
        ).status_code
        == 422
    )
