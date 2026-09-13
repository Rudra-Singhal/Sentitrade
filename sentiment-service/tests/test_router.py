"""Unit tests for routing and the ONNX->VADER degradation path.

A fake model stands in for a loaded ONNX session so the failure behaviour can
be tested without a 400MB download in CI.
"""

from app import router
from app.backends.onnx import _softmax
from app.schemas import ScoreItem

import numpy as np


class FakeModel:
    """Quacks like OnnxSentimentModel."""

    name = "fake/finbert"
    version = "test"

    def __init__(self, explode: bool = False):
        self.explode = explode
        self.seen: list[str] = []

    def score_batch(self, texts):
        if self.explode:
            raise RuntimeError("inference exploded")
        self.seen.extend(texts)
        return [(0.8, "positive", 0.95) for _ in texts]


def test_softmax_rows_sum_to_one():
    probs = _softmax(np.array([[2.0, 1.0, 0.1], [-5.0, 0.0, 5.0]], dtype=np.float32))
    assert np.allclose(probs.sum(axis=-1), 1.0)
    # Stable for large logits — no overflow to nan.
    assert not np.isnan(probs).any()


def test_news_and_social_route_to_different_models():
    assert router.ROUTES["news"] == router.ROUTES["filing"] == "finbert"
    assert router.ROUTES["social"] == router.ROUTES["forum"] == "social"


def test_uses_the_loaded_model_when_present(monkeypatch):
    fake = FakeModel()
    monkeypatch.setattr(router, "_models", {"finbert": fake})

    results = router.score_items([ScoreItem(id="1", text="earnings beat", source_type="news")])

    assert results[0].model == "fake/finbert"
    assert results[0].score == 0.8
    assert results[0].confidence == 0.95
    assert results[0].degraded is False
    assert fake.seen == ["earnings beat"]


def test_falls_back_to_vader_and_flags_degraded_when_inference_fails(monkeypatch):
    monkeypatch.setattr(router, "_models", {"finbert": FakeModel(explode=True)})

    results = router.score_items([ScoreItem(id="1", text="a terrible awful loss", source_type="news")])

    # The batch is still answered — a model crash must not fail the request.
    assert len(results) == 1
    assert results[0].model == "vader"
    assert results[0].degraded is True
    assert results[0].score < 0


def test_unrouted_source_type_uses_vader_without_flagging_degraded(monkeypatch):
    # Only the finance model is loaded; social documents have no model, which
    # is a configuration state rather than a failure.
    monkeypatch.setattr(router, "_models", {"finbert": FakeModel()})

    results = router.score_items([ScoreItem(id="1", text="to the moon", source_type="social")])

    assert results[0].model == "vader"
    assert results[0].degraded is False


def test_mixed_batch_keeps_ids_aligned_with_their_own_model(monkeypatch):
    monkeypatch.setattr(router, "_models", {"finbert": FakeModel()})

    results = router.score_items(
        [
            ScoreItem(id="news-1", text="guidance raised", source_type="news"),
            ScoreItem(id="social-1", text="this is garbage", source_type="social"),
            ScoreItem(id="news-2", text="guidance cut", source_type="news"),
        ]
    )

    by_id = {r.id: r for r in results}
    assert by_id["news-1"].model == "fake/finbert"
    assert by_id["news-2"].model == "fake/finbert"
    assert by_id["social-1"].model == "vader"
