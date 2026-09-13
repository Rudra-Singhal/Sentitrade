"""VADER fallback — always available, never the preferred scorer.

This is the same lexicon the Node backend used in M1 (`vader-sentiment` on npm
is a port of this Python original), so scores written before and after the M3
migration remain on one scale. It exists so the service is useful with zero
model downloads and so a failed ONNX load degrades instead of 500s.
"""

from importlib.metadata import PackageNotFoundError, version

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from ..schemas import Label

NAME = "vader"

try:
    VERSION = version("vaderSentiment")
except PackageNotFoundError:  # pragma: no cover - only when run from source
    VERSION = "unknown"

# VADER's own documented thresholds for the compound score.
_POSITIVE_AT = 0.05
_NEGATIVE_AT = -0.05

_analyzer = SentimentIntensityAnalyzer()


def label_for(score: float) -> Label:
    if score >= _POSITIVE_AT:
        return "positive"
    if score <= _NEGATIVE_AT:
        return "negative"
    return "neutral"


def score_batch(texts: list[str]) -> list[tuple[float, Label]]:
    """Score texts. VADER is pure-Python and per-document, so there is no real
    batching win here — the signature matches the ONNX backend so the router
    can treat them interchangeably."""
    out = []
    for text in texts:
        compound = _analyzer.polarity_scores(text)["compound"]
        out.append((compound, label_for(compound)))
    return out
