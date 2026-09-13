"""Wire format between the Node backend and this service.

The contract mirrors what `backend/src/pipeline/score.js` already writes onto
every RawDocument (`sentiment.{score,label,model,model_version,scored_at}`), so
swapping the in-process VADER scorer for this service is a drop-in change on
the Node side.
"""

from typing import Literal

from pydantic import BaseModel, Field

# Matches RawDocument.source_type in the Node model.
SourceType = Literal["news", "social", "forum", "filing", "derived"]
# Mirrors the `type` field on an asset in backend/src/services/assetService.js.
AssetClass = Literal["crypto", "equity"]
Label = Literal["positive", "negative", "neutral"]


class ScoreItem(BaseModel):
    # Caller-supplied correlation id; echoed back so a batch can be reassembled
    # without relying on list ordering.
    id: str
    text: str = Field(min_length=1)
    source_type: SourceType = "news"
    # The asset's market. Routing uses this: FinBERT was trained on equity
    # analyst prose and measurably misreads crypto flow language, so crypto
    # news goes to the social model instead. See scripts/evaluate.py.
    asset_class: AssetClass = "equity"
    # The resolved asset this document is about. Present from M3 phase 5
    # (target-aware scoring); ignored until then.
    target: str | None = None


class ScoreRequest(BaseModel):
    items: list[ScoreItem]


class ScoreResult(BaseModel):
    id: str
    # [-1, 1], same convention as VADER's compound score, so historical rows
    # stay comparable to newly-scored ones.
    score: float
    label: Label
    # Class probabilities when a transformer scored it; None for VADER, which
    # is a lexicon and has no calibrated posterior to report.
    confidence: float | None = None
    # Which model actually produced this score — never the one we wished had.
    model: str
    model_version: str
    # True when the intended model was unavailable and a fallback ran instead.
    degraded: bool = False


class ScoreResponse(BaseModel):
    results: list[ScoreResult]


class ModelInfo(BaseModel):
    name: str
    version: str
    loaded: bool
    handles: list[str]


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    onnx_available: bool
    models: list[ModelInfo]
