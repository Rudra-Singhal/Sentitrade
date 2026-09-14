"""Runtime configuration, read once from the environment.

Deliberately dependency-light: this service must boot on a 512MB free-tier
container, so there is no pydantic-settings, no torch, no transformers at
runtime — only onnxruntime + tokenizers if models are present, and VADER
otherwise.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

# Repo-relative default so `uvicorn app.main:app` works from the service root
# without any env setup.
_DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "models"


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    # Where export_models.py writes the ONNX graphs + tokenizers.
    model_dir: Path = field(default_factory=lambda: Path(os.environ.get("MODEL_DIR", _DEFAULT_MODEL_DIR)))

    # Hard ceiling on a single /score request. Node batches to this size.
    max_batch: int = field(default_factory=lambda: _int_env("MAX_BATCH", 64))

    # Tokens per document. Headlines and tweets are short; 128 covers both with
    # room to spare and keeps latency well inside the 300ms p95 budget.
    max_tokens: int = field(default_factory=lambda: _int_env("MAX_TOKENS", 128))

    # onnxruntime intra-op threads. 1 is correct on a shared free-tier vCPU:
    # more threads on a throttled core makes p95 worse, not better.
    threads: int = field(default_factory=lambda: _int_env("ORT_THREADS", 1))

    # Set to "1" to refuse to start unless the ONNX models loaded — useful in
    # production where silently degrading to VADER would be a data-quality bug.
    require_onnx: bool = field(default_factory=lambda: os.environ.get("REQUIRE_ONNX") == "1")


settings = Settings()
