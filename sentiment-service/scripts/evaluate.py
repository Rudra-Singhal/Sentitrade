"""Measure whether a model swap is actually an upgrade.

M3 replaces a lexicon with transformers. "Transformers are better" is an
assumption until it is measured on the text this system actually ingests, so
this script scores a small hand-labelled set of real-shaped headlines and
posts through every available backend and prints per-model accuracy plus the
disagreements.

    .venv/bin/python scripts/evaluate.py

It is deliberately not a pytest: the labels are a judgement call, the set is
tiny, and a number that moves with a model upgrade should be read by a person,
not used to fail a build.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import router  # noqa: E402
from app.backends import vader  # noqa: E402
from app.schemas import ScoreItem  # noqa: E402

# (text, source_type, asset_class, expected label). Drawn from the shapes this pipeline
# really sees: equity/crypto headlines from the RSS + NewsAPI connectors and
# retail posts from StockTwits/Reddit. "neutral" means a reader would not trade
# on it either way.
CASES: list[tuple[str, str, str, str]] = [
    # --- unambiguous equity news, FinBERT's home turf ---
    ("Reliance beats quarterly estimates as refining margins expand", "news", "equity", "positive"),
    ("Tesla announces record deliveries, raising full-year outlook", "news", "equity", "positive"),
    ("Company slashes guidance after disastrous quarter, shares plunge", "news", "equity", "negative"),
    ("Shares fell 4% after the company missed consensus on thin volumes", "news", "equity", "negative"),
    ("Infosys wins $1.5 billion multi-year deal with European bank", "news", "equity", "positive"),
    ("HDFC Bank reports higher provisions as asset quality weakens", "news", "equity", "negative"),
    ("Board approves buyback of up to 2% of outstanding shares", "news", "equity", "positive"),
    ("Regulator opens investigation into accounting practices", "news", "equity", "negative"),
    # --- crypto flow language: out of FinBERT's training distribution ---
    ("Bitcoin ETF outflows accelerate as investors pull $449M in three days", "news", "crypto", "negative"),
    ("Spot bitcoin ETFs post record weekly inflows of $1.2B", "news", "crypto", "positive"),
    ("Exchange reserves climb as holders move coins back onto exchanges", "news", "crypto", "negative"),
    # --- genuinely neutral reporting ---
    ("Company to report third quarter results on November 14", "news", "equity", "neutral"),
    ("Index rebalancing takes effect at the close on Friday", "news", "equity", "neutral"),
    # --- retail social register ---
    ("$BTC to the moon 🚀🚀 loading up here", "social", "crypto", "positive"),
    ("this is going to zero, bagholders in shambles", "social", "equity", "negative"),
    ("puts printing today boys 📉", "social", "equity", "negative"),
    ("holding through the dip, long term thesis unchanged", "social", "equity", "positive"),
    ("anyone know when earnings drop?", "social", "equity", "neutral"),
]


def label_from_score(score: float) -> str:
    if score >= 0.05:
        return "positive"
    if score <= -0.05:
        return "negative"
    return "neutral"


def main() -> int:
    router.load_models()
    models = router.loaded_models()
    print(f"loaded ONNX models: {sorted(models) or 'none'}\n")

    texts = [c[0] for c in CASES]
    expected = [c[3] for c in CASES]

    columns: dict[str, list[str]] = {}

    # VADER over everything, as the M1–M2 baseline.
    columns["vader"] = [label_from_score(s) for s, _ in vader.score_batch(texts)]

    # Each loaded transformer over everything, so news and social models can be
    # compared on both registers rather than only the one they are routed.
    for slug, model in sorted(models.items()):
        columns[slug] = [label_from_score(s) for s, _, _ in model.score_batch(texts)]

    # What the service would actually return, with real routing applied.
    routed = router.score_items(
        [
            ScoreItem(id=str(i), text=t, source_type=st, asset_class=ac)
            for i, (t, st, ac, _) in enumerate(CASES)
        ]
    )
    by_id = {r.id: r for r in routed}
    columns["routed"] = [label_from_score(by_id[str(i)].score) for i in range(len(CASES))]

    name_width = max(len(n) for n in columns) + 2
    print("accuracy on %d hand-labelled cases" % len(CASES))
    print("-" * 46)
    for name, preds in columns.items():
        hits = sum(p == e for p, e in zip(preds, expected))
        print(f"  {name:<{name_width}} {hits:>2}/{len(CASES)}  {hits / len(CASES):>6.1%}")

    print("\ncases the routed service gets wrong")
    print("-" * 46)
    for i, (text, source_type, asset_class, want) in enumerate(CASES):
        got = columns["routed"][i]
        if got == want:
            continue
        result = by_id[str(i)]
        print(f"  [{source_type}/{asset_class}] {text[:58]}")
        print(f"      want={want:<8} got={got:<8} score={result.score:+.3f} model={result.model}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
