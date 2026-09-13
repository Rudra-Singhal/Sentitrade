"""ONNX Runtime inference for the finance/social sentiment transformers.

Loads a model exported by `scripts/export_models.py`. Runtime needs only
onnxruntime + tokenizers — not torch, not transformers — which is what keeps
this service inside a free-tier memory budget.

A model directory is expected to contain:
    model.onnx        the exported graph
    tokenizer.json    a fast-tokenizers serialization
    meta.json         {"name", "version", "id2label", "max_tokens"}
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np

from ..schemas import Label

logger = logging.getLogger(__name__)


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=-1, keepdims=True)


class OnnxSentimentModel:
    """One loaded ONNX classifier. Construct via `load()`, which returns None
    rather than raising when the model isn't on disk — a missing model is an
    expected state (fresh checkout, free-tier deploy without the download step),
    not an error."""

    def __init__(self, name: str, version: str, session, tokenizer, id2label: dict[int, str], max_tokens: int):
        self.name = name
        self.version = version
        self._session = session
        self._tokenizer = tokenizer
        self._id2label = id2label
        self._max_tokens = max_tokens
        self._input_names = {i.name for i in session.get_inputs()}

    @classmethod
    def load(cls, model_dir: Path, threads: int, max_tokens: int) -> "OnnxSentimentModel | None":
        graph = model_dir / "model.onnx"
        tok_file = model_dir / "tokenizer.json"
        meta_file = model_dir / "meta.json"
        if not (graph.exists() and tok_file.exists() and meta_file.exists()):
            logger.info("no ONNX model at %s — skipping", model_dir)
            return None

        try:
            import onnxruntime as ort
            from tokenizers import Tokenizer
        except ImportError:
            logger.warning("onnxruntime/tokenizers not installed — ONNX backend unavailable")
            return None

        try:
            meta = json.loads(meta_file.read_text())
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = threads
            opts.inter_op_num_threads = threads
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            session = ort.InferenceSession(str(graph), opts, providers=["CPUExecutionProvider"])

            tokenizer = Tokenizer.from_file(str(tok_file))
            limit = int(meta.get("max_tokens", max_tokens))
            tokenizer.enable_truncation(max_length=limit)
            tokenizer.enable_padding()

            return cls(
                name=meta["name"],
                version=str(meta.get("version", "unknown")),
                session=session,
                tokenizer=tokenizer,
                id2label={int(k): v.lower() for k, v in meta["id2label"].items()},
                max_tokens=limit,
            )
        except Exception:
            logger.exception("failed to load ONNX model from %s", model_dir)
            return None

    def score_batch(self, texts: list[str]) -> list[tuple[float, Label, float]]:
        """-> [(score in [-1,1], label, confidence)]

        The score is `P(positive) - P(negative)`, which places a transformer's
        output on the same [-1, 1] axis as VADER's compound score. Confidence is
        the winning class probability."""
        encodings = self._tokenizer.encode_batch(texts)
        feed = {
            "input_ids": np.array([e.ids for e in encodings], dtype=np.int64),
            "attention_mask": np.array([e.attention_mask for e in encodings], dtype=np.int64),
        }
        # Some exports keep token_type_ids (BERT-family), others drop it
        # (RoBERTa-family). Only feed what this graph actually declares.
        if "token_type_ids" in self._input_names:
            feed["token_type_ids"] = np.array([e.type_ids for e in encodings], dtype=np.int64)
        feed = {k: v for k, v in feed.items() if k in self._input_names}

        logits = self._session.run(None, feed)[0]
        probs = _softmax(np.asarray(logits, dtype=np.float32))

        results: list[tuple[float, Label, float]] = []
        for row in probs:
            by_label = {self._id2label.get(i, str(i)): float(p) for i, p in enumerate(row)}
            positive = by_label.get("positive", 0.0)
            negative = by_label.get("negative", 0.0)
            score = positive - negative
            top = max(by_label, key=by_label.get)
            label: Label = top if top in ("positive", "negative", "neutral") else "neutral"
            results.append((score, label, by_label[top]))
        return results
