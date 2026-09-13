"""Model routing.

Financial news and retail social posts do not share a dialect: "beat consensus
by 4c" and "wen moon 🚀" need different models. Documents are therefore routed
by `source_type` to the model trained on that register, and anything without a
loaded model falls through to VADER rather than being scored by the wrong one.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from .backends import vader
from .backends.onnx import OnnxSentimentModel
from .config import settings
from .schemas import ScoreItem, ScoreResult

logger = logging.getLogger(__name__)

# source_type -> model directory name under MODEL_DIR.
# `finbert` is trained on financial reporting; `social` is the Twitter/Reddit
# register. Filings read like news, so they share the finance model.
ROUTES: dict[str, str] = {
    "news": "finbert",
    "filing": "finbert",
    "social": "social",
    "forum": "social",
    "derived": "finbert",
}

_models: dict[str, OnnxSentimentModel] = {}
_loaded = False


def load_models() -> None:
    """Load every routed model once, at startup. Missing models are logged and
    skipped — the service still serves, via VADER, and says so in /health."""
    global _loaded
    _models.clear()
    for slug in sorted(set(ROUTES.values())):
        model = OnnxSentimentModel.load(
            settings.model_dir / slug, threads=settings.threads, max_tokens=settings.max_tokens
        )
        if model is not None:
            _models[slug] = model
            logger.info("loaded %s (%s) from %s", model.name, model.version, slug)
    _loaded = True

    if not _models:
        if settings.require_onnx:
            raise RuntimeError(
                f"REQUIRE_ONNX=1 but no ONNX models loaded from {settings.model_dir}. "
                "Run scripts/export_models.py first."
            )
        logger.warning("no ONNX models loaded — every document will be scored by VADER")


def model_for(source_type: str) -> OnnxSentimentModel | None:
    return _models.get(ROUTES.get(source_type, "finbert"))


def loaded_models() -> dict[str, OnnxSentimentModel]:
    return dict(_models)


def is_loaded() -> bool:
    return _loaded


def score_items(items: list[ScoreItem]) -> list[ScoreResult]:
    """Score a mixed batch, grouped so each model runs once over all the
    documents routed to it rather than once per document."""
    by_model: dict[str | None, list[int]] = defaultdict(list)
    for index, item in enumerate(items):
        model = model_for(item.source_type)
        by_model[model.name if model else None].append(index)

    results: list[ScoreResult | None] = [None] * len(items)

    for model_name, indexes in by_model.items():
        texts = [items[i].text for i in indexes]

        model = next((m for m in _models.values() if m.name == model_name), None) if model_name else None

        if model is not None:
            try:
                for i, (score, label, confidence) in zip(indexes, model.score_batch(texts)):
                    results[i] = ScoreResult(
                        id=items[i].id,
                        score=round(score, 4),
                        label=label,
                        confidence=round(confidence, 4),
                        model=model.name,
                        model_version=model.version,
                    )
                continue
            except Exception:
                # An inference failure must not fail the batch — fall through to
                # VADER and mark every affected row degraded.
                logger.exception("inference failed for %s — degrading to VADER", model_name)

        degraded = model_name is not None
        for i, (score, label) in zip(indexes, vader.score_batch(texts)):
            results[i] = ScoreResult(
                id=items[i].id,
                score=round(score, 4),
                label=label,
                confidence=None,
                model=vader.NAME,
                model_version=vader.VERSION,
                degraded=degraded,
            )

    return [r for r in results if r is not None]
