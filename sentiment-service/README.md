# SentiTrade sentiment service

A small FastAPI service that scores documents with sentiment models trained on
the register they were written in — financial reporting for news and filings,
social media for StockTwits/Reddit/X — instead of the single general-purpose
lexicon the Node backend used through M1–M2.

It is a separate process, not a Node dependency, because the model runtime is
Python. The Node backend calls it over HTTP and degrades to its existing
in-process scorer if this service is unreachable, so it is an upgrade rather
than a hard dependency.

## Why ONNX and not PyTorch

Serving needs `onnxruntime` + `tokenizers` (~60MB). Exporting needs `torch` +
`transformers` + `optimum` (~2.5GB) and happens once, offline. Keeping those in
separate requirements files is what lets this run on a free-tier container.

| | install | in the deployed image |
|---|---|---|
| `requirements.txt` | serving | yes |
| `requirements-export.txt` | one-time model export | no |
| `requirements-dev.txt` | tests + lint | no |

## Models

| Route | Model | Handles |
|---|---|---|
| `finbert` | [`ProsusAI/finbert`](https://huggingface.co/ProsusAI/finbert) | `news`, `filing`, `derived` |
| `social` | [`cardiffnlp/twitter-roberta-base-sentiment-latest`](https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest) | `social`, `forum` |
| fallback | VADER (lexicon) | anything without a loaded model |

The fallback is not a formality. With no models downloaded the service still
answers every request — it just says `"model": "vader"` in the response, and
`/health` reports `"status": "degraded"`. Nothing is ever labelled as having
been scored by a model that did not score it.

## Run it

```bash
cd sentiment-service
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8099
```

That works immediately, on VADER. To get the real models:

```bash
.venv/bin/pip install -r requirements-export.txt   # ~2.5GB, one time
.venv/bin/python scripts/export_models.py          # downloads + converts to ONNX
```

Models land in `./models/` (gitignored) and are picked up on next start.

## API

`POST /score`

```json
{ "items": [ { "id": "doc-1", "text": "Profits beat estimates", "source_type": "news" } ] }
```

```json
{ "results": [ {
  "id": "doc-1", "score": 0.86, "label": "positive", "confidence": 0.94,
  "model": "ProsusAI/finbert", "model_version": "main", "degraded": false
} ] }
```

`score` is always in `[-1, 1]` — `P(positive) - P(negative)` for a transformer,
the compound score for VADER — so rows written before and after this migration
stay on one scale. `degraded: true` means the routed model existed but failed
and VADER answered instead.

`GET /health` reports which models are loaded and what each one handles.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MODEL_DIR` | `./models` | where `export_models.py` wrote the ONNX graphs |
| `MAX_BATCH` | `64` | requests above this get a 413 |
| `MAX_TOKENS` | `128` | truncation length; headlines and posts fit comfortably |
| `ORT_THREADS` | `1` | correct on a shared free-tier vCPU |
| `REQUIRE_ONNX` | unset | set to `1` to refuse to start on VADER-only, for production |

## Tests

```bash
.venv/bin/python -m pytest -q
```

The suite runs without any model present — the degraded path is the one most
likely to break silently, so it is the one CI covers. A fake model stands in
for a loaded session to test routing and inference-failure fallback.
