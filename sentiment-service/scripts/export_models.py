"""One-time: download HuggingFace sentiment models and export them to ONNX.

Run this on a dev machine (or a build step) — never at serving time. It needs
torch + transformers + optimum (see requirements-export.txt, ~2.5GB); the
service itself then runs on onnxruntime alone (~60MB).

    pip install -r requirements-export.txt
    python scripts/export_models.py

Writes into MODEL_DIR (default ./models), which is gitignored:

    models/finbert/{model.onnx,tokenizer.json,meta.json}
    models/social/{model.onnx,tokenizer.json,meta.json}
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "models"

# slug -> (HF repo id, why this one)
MODELS = {
    # Trained on financial news/analyst text; the register our news and filing
    # documents are actually written in.
    "finbert": "ProsusAI/finbert",
    # Trained on ~124M tweets and tuned for sentiment; handles the emoji,
    # cashtags and irony of StockTwits/Reddit that FinBERT was never shown.
    "social": "cardiffnlp/twitter-roberta-base-sentiment-latest",
}

MAX_TOKENS = 128


def export_one(slug: str, repo_id: str, out_root: Path) -> None:
    from optimum.onnxruntime import ORTModelForSequenceClassification
    from transformers import AutoConfig, AutoTokenizer

    out_dir = out_root / slug
    tmp_dir = out_root / f".{slug}.tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    print(f"[{slug}] exporting {repo_id} -> {out_dir}")

    model = ORTModelForSequenceClassification.from_pretrained(repo_id, export=True)
    model.save_pretrained(tmp_dir)

    tokenizer = AutoTokenizer.from_pretrained(repo_id)
    tokenizer.save_pretrained(tmp_dir)

    config = AutoConfig.from_pretrained(repo_id)
    id2label = {int(k): str(v) for k, v in config.id2label.items()}

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    onnx_files = sorted(tmp_dir.glob("*.onnx"))
    if not onnx_files:
        raise SystemExit(f"[{slug}] export produced no .onnx file in {tmp_dir}")
    shutil.copy(onnx_files[0], out_dir / "model.onnx")

    tokenizer_json = tmp_dir / "tokenizer.json"
    if not tokenizer_json.exists():
        raise SystemExit(
            f"[{slug}] {repo_id} has no fast tokenizer.json; the runtime needs one "
            "(the `tokenizers` library cannot load a slow/sentencepiece-only tokenizer)."
        )
    shutil.copy(tokenizer_json, out_dir / "tokenizer.json")

    (out_dir / "meta.json").write_text(
        json.dumps(
            {
                "name": repo_id,
                "version": getattr(config, "_commit_hash", None) or "main",
                "id2label": id2label,
                "max_tokens": MAX_TOKENS,
            },
            indent=2,
        )
    )

    shutil.rmtree(tmp_dir)
    size_mb = (out_dir / "model.onnx").stat().st_size / 1e6
    print(f"[{slug}] done — {size_mb:.0f}MB, labels={list(id2label.values())}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output directory")
    parser.add_argument("--only", choices=sorted(MODELS), help="export a single model")
    args = parser.parse_args()

    targets = {args.only: MODELS[args.only]} if args.only else MODELS
    args.out.mkdir(parents=True, exist_ok=True)

    for slug, repo_id in targets.items():
        export_one(slug, repo_id, args.out)

    print(f"\nAll set. Start the service with MODEL_DIR={args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
