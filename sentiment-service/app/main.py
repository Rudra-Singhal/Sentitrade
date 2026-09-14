"""SentiTrade sentiment service.

A small FastAPI app the Node backend calls over HTTP to score documents. It
exists so sentiment can come from a model trained on financial text rather than
a general-purpose lexicon, without dragging a Python ML stack into the Node
process.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from . import router as model_router
from .backends import vader
from .config import settings
from .schemas import HealthResponse, ModelInfo, ScoreRequest, ScoreResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("sentiment-service")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load at startup, not on first request, so the first scored batch isn't
    # the one that pays a multi-second model load.
    model_router.load_models()
    yield


app = FastAPI(
    title="SentiTrade sentiment service",
    version="1.0.0",
    summary="Routes documents to a finance or social sentiment model, VADER as fallback.",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    models = model_router.loaded_models()

    def route_label(key: tuple[str, str]) -> str:
        source_type, asset_class = key
        return f"{source_type}/{asset_class}"

    infos = [
        ModelInfo(
            name=model.name,
            version=model.version,
            loaded=True,
            handles=sorted(route_label(k) for k, v in model_router.ROUTES.items() if v == slug),
        )
        for slug, model in sorted(models.items())
    ]
    # VADER is always present, and always listed, so an operator reading
    # /health can see exactly what would score an incoming document.
    covered = {h for i in infos for h in i.handles}
    infos.append(
        ModelInfo(
            name=vader.NAME,
            version=vader.VERSION,
            loaded=True,
            handles=sorted(route_label(k) for k in model_router.ROUTES if route_label(k) not in covered),
        )
    )
    return HealthResponse(
        status="ok" if models else "degraded",
        onnx_available=bool(models),
        models=infos,
    )


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest) -> ScoreResponse:
    if not request.items:
        return ScoreResponse(results=[])
    if len(request.items) > settings.max_batch:
        raise HTTPException(
            status_code=413,
            detail=f"batch of {len(request.items)} exceeds MAX_BATCH={settings.max_batch}",
        )

    started = time.perf_counter()
    results = model_router.score_items(request.items)
    elapsed_ms = (time.perf_counter() - started) * 1000
    logger.info("scored batch size=%d in %.1fms", len(request.items), elapsed_ms)

    return ScoreResponse(results=results)
