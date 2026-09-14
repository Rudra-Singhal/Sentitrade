"""End-to-end tests through the real FastAPI app.

These deliberately run with NO ONNX model loaded — the degraded path is the one
most likely to break silently, and it is the only path CI can exercise, since a
900MB pair of models cannot live in the repo.

`MODEL_DIR` is pointed at an empty directory rather than relying on models
being absent: on a developer machine that has run `export_models.py` they are
very much present, and a test that changes behaviour based on what is sitting
on disk is not a test.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(tmp_path_factory, monkeypatch_module):
    empty = tmp_path_factory.mktemp("no-models")
    monkeypatch_module.setenv("MODEL_DIR", str(empty))

    # Settings is a frozen dataclass read at import time, so swap in a replaced
    # copy rather than mutating the original.
    import dataclasses

    import app.config
    import app.router
    from app.main import app as fastapi_app

    empty_settings = dataclasses.replace(app.config.settings, model_dir=empty)
    monkeypatch_module.setattr(app.config, "settings", empty_settings)
    monkeypatch_module.setattr(app.router, "settings", empty_settings)

    with TestClient(fastapi_app) as c:
        yield c


@pytest.fixture(scope="module")
def monkeypatch_module():
    """module-scoped monkeypatch (the built-in fixture is function-scoped)."""
    mp = pytest.MonkeyPatch()
    yield mp
    mp.undo()


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
