# SentiTrade — Methodology & Limitations

> This document explains exactly how every number in SentiTrade is produced, what the data
> sources are, and — importantly — what SentiTrade does **not** do. It is deliberately blunt.
> This is a stub that will grow into an interactive page (see `V2_ROADMAP.md`, milestone M5).

## What SentiTrade is

An **educational** dashboard that puts two things on one screen for a single asset:

1. The **tone of recent news headlines** about that asset (positive / neutral / negative).
2. The **price movement** of that asset over the same time window.

It then describes whether those two moved **in the same direction, opposite directions, or
sideways** this window, and renders a rule-based **BUY / SELL / HOLD** label.

## What SentiTrade is NOT

- **Not a price predictor.** Nothing here forecasts future prices. "Sentiment and price moved
  together this hour" is a description of the past, not a prediction of the next hour.
- **Not investment advice.** The BUY / SELL / HOLD label is an illustration of a fixed rule set.
  It is not a recommendation to buy or sell anything.
- **Not backtested.** As of this milestone there is no historical evaluation of whether the
  signal has ever been profitable, or better than chance. Do not assume it is.
- **Not a real "correlation".** The "sentiment vs price" panel compares the start and end of the
  window. It is co-movement of two endpoints, not a statistical correlation coefficient, and it
  is computed over a very small sample. A real rolling correlation (with `r`, sample size, and
  confidence interval) is planned for a later milestone.

## Data sources

| Panel | Source | Notes |
|---|---|---|
| Price chart | TradingView embedded widget | This is genuinely live. It is the only always-live element. |
| News headlines | NewsAPI (`/v2/everything`) | Free tier: 100 requests/day, articles may be delayed. When unavailable, see "Data honesty" below. |
| News sentiment score | VADER (`vader-sentiment`) | A general-purpose lexicon model. It is **not** tuned for financial language and will misread finance-specific phrasing. A finance-specific model is planned (roadmap M3). |
| Backend price series / "Price Move" | CoinGecko (crypto only, opt-in) or **unavailable** | Live backend price is off by default. Stocks have no backend price source yet. |
| Sentiment trend | Aggregated from stored headline sentiment, grouped by minute | Sparse and noisy over short windows. |

## Data honesty

Every value the API returns carries a `data_source` label, shown in the UI as a badge:

- **live** — fetched fresh from a real provider this cycle.
- **cached** — real data from our store, not refreshed this cycle.
- **delayed** — real data, but the provider itself lags real time.
- **simulated** — synthetic demo data. **Only ever shown outside production**, and always
  badged. A prominent banner appears whenever any panel is simulated.
- **unavailable** — no real data is available. The UI shows "—" rather than an estimate. In
  production, synthetic data is never substituted.

## The sentiment score

1. Each headline's title is scored by VADER, producing a `compound` score in `[-1, 1]`.
2. Label: `>= 0.05` positive, `<= -0.05` negative, otherwise neutral.
3. The panel score is the **unweighted mean** of the last ~20 headlines, rescaled to `0–100%`.

Known weaknesses: no relevance filtering (off-topic headlines still count), no de-duplication of
near-identical wire stories, no weighting by source credibility or recency, headline-only (the
article body is ignored), and no entity attribution (a headline about two companies gets one
score).

## The "sentiment vs price" panel

- `sentiment_change` = (sentiment % at window end) − (sentiment % at window start).
- `price_change` = percent change of the price series over the window.
- If both moved more than a small threshold in the **same** direction → "moved in the same
  direction"; opposite → "moved in opposite directions"; otherwise → "roughly flat".

This is **not** predictive and **not** a correlation coefficient.

## The BUY / SELL / HOLD label

A transparent rule engine adds and subtracts integer points based on: overall news tone,
positive/negative headline ratio, sentiment change over the window, and price change over the
window. Score `>= 4` → BUY, `<= -4` → SELL, otherwise HOLD.

- The thresholds and weights are **hand-chosen and unvalidated**.
- "Signal alignment" strength (weak / moderate / strong) reflects the **magnitude of the rule
  score only**. It is **not** a probability and **not** a confidence that the call is correct.
- If live data is insufficient, the label is forced to HOLD with an "insufficient data" reason.

## Roadmap

See [`V2_ROADMAP.md`](./V2_ROADMAP.md) for how these limitations are being addressed —
multi-source ingestion, a finance-specific sentiment model, real rolling correlation, and a
walk-forward backtest with transaction costs and a calibration curve. See [`AUDIT.md`](./AUDIT.md)
for the full technical audit that motivated this work.
