# SentiTrade v2 — Roadmap & Multi-Source Data Pipeline Plan

> Companion to [AUDIT.md](AUDIT.md). This plans the work that closes the audit gaps and expands the sentiment pipeline beyond NewsAPI to news + StockTwits + Reddit + X + filings + attention/derived signals.
> Planning only — no implementation until approved.

---

## 1. What "v2" means (definition of done)

v2 is the version where **every number on the screen is either real or explicitly labelled as not real**, the signal is **backed by a walk-forward backtest**, and sentiment is aggregated from **multiple independent source classes** with entity resolution, spam filtering, dedup, and credibility weighting.

v2 is **not**: distributed infra, microservices, a paid data budget beyond ~$50–100/mo, real-money trading, or user accounts. It stays a single Node service + one worker process + MongoDB + (new) Redis + a small Python sentiment service.

**v2 acceptance checklist**
- [ ] No synthetic data served in `NODE_ENV=production`; unavailable data renders as an explicit empty/stale state.
- [ ] Every API field carries `data_source` + `as_of`; the UI badges them.
- [ ] Sentiment aggregated from ≥3 source classes (news, retail-social, forum) with per-source credibility weights.
- [ ] Documents are entity-resolved to the asset universe, relevance-filtered, deduped across sources, and bot/spam-filtered (social).
- [ ] Sentiment scored by source-appropriate models (FinBERT for news/filings, social model for tweets/reddit), cached by content hash with `model_version`.
- [ ] A per-asset per-bucket **feature store** (`SentimentFeatures`) is the only thing the serving layer reads.
- [ ] A reproducible walk-forward backtest exists with transaction costs, benchmarks, and a calibration curve; the UI wording matches what the backtest supports.
- [ ] Tests + CI + structured logging + error tracking + uptime + pipeline metrics (including a hard "mock served in prod" = 0 alert).
- [ ] `npm audit` clean; secrets rotated; input validation on every route.

---

## 2. Guiding principles

1. **Ingestion, processing, aggregation, and serving are separate stages** joined by a canonical schema — so adding a 6th source never touches the serving code.
2. **Start collecting early.** Historical social data is mostly un-buyable; the ingestion stack ships in Milestone 1 so history accumulates while later milestones are built.
3. **Every source is optional and independently circuit-broken.** One dead provider degrades a weight, never the product.
4. **Score each unique document once, ever** (content-hash cache).
5. **Honest before clever** — ship the rule baseline + honest labels first; the ML signal only replaces it if it wins out-of-sample.
6. **Budget discipline** — free tiers + one or two cheap paid sources; a daily cost ceiling per source with an 80% alert.

---

## 3. Workstreams

| # | Workstream | Closes audit items | Milestones |
|---|---|---|---|
| A | Honesty & safety hardening | A1–A10, S1–S13, B5, B9, B10 | M0 |
| B | Ingestion platform (connectors, scheduler, normalization) | A2, B2, §5 (news pipeline) | M1 |
| C | Multi-source expansion (StockTwits, Reddit, X, EDGAR, attention) | new | M2 |
| D | Enrichment (entity resolution, relevance, dedup, bot filter) | B7, §5.1 | M2 |
| E | Sentiment modelling (FinBERT/social/LLM + cache + events) | §4 | M3 |
| F | Feature store & aggregation | B6, B11, B13, §6 | M3 |
| G | Real market data + calendar | A1, B16, §5.2 | M1–M2 |
| H | Backtesting & signal v2 | §16, §17 | M4 |
| I | Realtime, DB, backend hardening | B1–B4, B8, B12, B14, B15, §7, §8 | M1–M2 |
| J | Observability & DevOps | §12, §13 | M1 (baseline), continuous |
| K | Frontend v2 (states, a11y, overlay, methodology, explain-signal) | §9, §14, §15 | M5 |

---

## 4. Milestone plan

### M0 — Stop misleading users (≈1 week)
Pure gap-closure, no new features. Ship-blocking for anything public.

| Task | Detail | Exit criteria |
|---|---|---|
| Dependency + secret hygiene | `npm audit fix` both apps; bump socket.io/client; rotate NewsAPI key + Mongo creds; least-priv DB user; Atlas IP allowlist → Render egress; add `gitleaks` to CI | `npm audit --audit-level=high` clean; new creds live; old creds revoked |
| Structured logging + redaction | `pino` + `pino-http`; redaction serializer; stop `console.error(error)`; log `{msg,name,status,code}` only | no secret can appear in logs; grep test in CI |
| `data_source` contract | add `data_source` (`live\|cached\|delayed\|simulated\|unavailable`) + `as_of` to every API/socket field; zod response schemas | every response validates; contract test passes |
| Kill prod mock | when `NODE_ENV=production`, all fallbacks return `unavailable` instead of synthetic; metric `mock_served_in_production_total` (alert if >0) | staged prod shows empty states, not fake data |
| UI honesty pass | per-panel freshness/`data_source` badge; global "some data simulated/unavailable" banner; render the disclaimer persistently; remove "confidence %" → "weak/moderate/strong alignment"; reword predictive language; add `METHODOLOGY.md` stub + link | manual review: no number is presented as live without proof; disclaimer visible on every screen |
| Correlation relabel | rename "Positive correlation detected" → co-movement language with an explicit "not predictive" note (real rolling-r comes in M4) | wording review |
| Input validation | `zod` on all query params; 400 on bad input; fix `limit`→`NaN` | fuzz test passes |
| Real readiness | `/api/ready` = Mongo `readyState===1` + last-successful-fetch age + mock-rate; point Render at it | degraded instance fails readiness |
| Backend safety | fail-fast on DB failure in prod (or loud alarm); complete graceful shutdown (io + mongoose + forced-exit timeout) | SIGTERM drains cleanly in <10s |

### M1 — Ingestion platform + real market data + CI (≈2–3 weeks)

| Task | Detail | Exit criteria |
|---|---|---|
| **Source connector interface** | `SourceConnector { id, sourceType, cadence, fetch(entity, since) → RawDocument[], healthcheck() }`; one module per provider; config-toggleable; own rate limiter + `axios-retry` + `opossum` breaker | interface documented; NewsAPI + one finance-news provider implemented against it |
| **Ingestion scheduler + queue** | introduce **Redis** (justified here by the job queue + cache + later socket adapter, not by scale); **BullMQ** repeatable jobs per source; retry/backoff; concurrency caps; dead-letter | jobs run on cadence, survive restart, retry on failure; dashboard shows queue depth |
| **Normalization stage** | map every `RawDocument` → canonical `SentimentDocument` (§5.3); store raw provider payload for reproducibility | all sources produce identical downstream shape |
| Finance-native news providers | add **Marketaux** or **Alpha Vantage NEWS_SENTIMENT** (built-in entity + relevance) + **Finnhub company-news** (free 60/min); NewsAPI demoted to one-of-many | ≥2 news providers live, deduped |
| RSS supplement | direct RSS: Reuters/CoinDesk/The Block/SEC latest-filings feeds — free, no quota | RSS docs flow through the same pipeline |
| **Real prices + calendar** | Binance klines (crypto, free, WS+REST); Alpaca IEX or Finnhub or Tiingo (equities); exchange-calendar handling (market hours/holidays, last-close semantics, UTC storage) | `price_source: live` for all supported assets; no fabricated overnight equity moves |
| DB hardening | compound `{asset:1,timestamp:-1}` index; TTL (90d) on raw; `dedupeKey` hash + unique; `bulkWrite` upserts; connection opts | load test: writes batched, collection bounded |
| Decouple reads | ingestion only via jobs; `GET /api/*` and socket only read cached rollups/features; `refresh` param removed | zero provider calls in the request path |
| Realtime redesign | scheduler computes one snapshot per active `asset:range` room; `io.to(room).emit`; event validation; drop polling in prod; conn caps | 500-socket load test → 1 recompute/interval |
| Frontend channel cleanup | socket = live channel, REST = first paint only; ErrorBoundary; restore StrictMode; filter asset+range | no REST/socket race; no white-screen on throw |
| CI/CD baseline | GitHub Actions: lint (ESLint/Prettier) → Vitest unit → supertest integration (`mongodb-memory-server`, `nock`) → build both → `npm audit` → coverage ≥60% (ratchet to 70%); `.nvmrc` Node 20 | red build blocks merge |
| Observability baseline | Sentry (both apps); UptimeRobot on `/api/ready`; pipeline metrics: `ingest_docs_total{source,outcome}`, `provider_errors_total{source}`, `queue_depth`, `snapshot_compute_ms` | dashboard + alerts on ready-fail, error spike, `mock_served_in_production>0` |

### M2 — Multi-source expansion + enrichment (≈3–4 weeks)

| Task | Detail | Exit criteria |
|---|---|---|
| **StockTwits connector** | per-symbol streams; native Bull/Bear labels; cashtag entities; ~free (verify current partner-key requirement) | StockTwits docs in the pipeline with native sentiment preserved as a feature |
| **Reddit connector** | OAuth script app (free tier); `snoowrap`; target subs per asset class (r/wallstreetbets, r/stocks, r/investing, r/CryptoCurrency, r/Bitcoin, r/ethtrader …); pull new submissions + top-N comments; score/award weighting; mention-velocity tracking | Reddit docs flowing; per-asset mention counts + upvote-weighted sentiment |
| **SEC EDGAR connector** | submissions API + latest-filings RSS per CIK; 8-K / 10-Q / 10-K / Form 4; `User-Agent` header; full-text search for event detection | filing events tagged to equities within ~15 min of publication |
| Attention / derived signals | CNN Fear & Greed (equities) + alternative.me F&G (crypto), both free; Wikipedia pageviews (free); Google Trends daily (unofficial, low-priority, best-effort) | derived features stored per asset/day |
| X / Twitter connector | **deferred, behind a flag** — implement the connector interface but leave disabled; if enabled later, Basic tier ($200/mo) or a compliant reseller; strict cashtag + relevance gating due to noise | connector exists, off by default, documented cost |
| **Entity resolution** | per-asset gazetteer (symbol, name, aliases, cashtag, common misspellings, product/CEO names, crypto slang); Aho-Corasick / flashtext matcher; ambiguity rules (require `$` cashtag or context for `V`, `SNAP`, `ETH`-as-word); output `entities:[{symbol,salience,mentions}]` | precision/recall measured on a hand-labelled 200-doc set (>0.9 precision) |
| **Relevance scoring** | is the doc *about* the asset vs a passing mention? embedding cosine to asset description, or a small classifier; drop below threshold before aggregation | off-topic-mention docs excluded; measured on the labelled set |
| **Cross-source dedup** | exact (content hash) + near-dup (SimHash or MinHash + LSH) across all sources within a rolling window; collapse wire-story reprints, retweets, crossposts into one weighted doc | dup rate on a sample <2% post-filter |
| **Bot / spam filtering (social)** | heuristics: account age, follower/following ratio, post cadence, duplicate-text bursts, promo-link density, coordinated-posting clusters; down-weight or drop; flag `author_quality` | seeded bot accounts scored low; precision spot-checked |
| Source credibility table | config: base weight per source (Reuters 1.0 … WSB 0.25 …); refined empirically in M4 from lead/lag analysis | weights applied in aggregation; documented rationale |

### M3 — Sentiment modelling + feature store (≈3–4 weeks)

| Task | Detail | Exit criteria |
|---|---|---|
| **Sentiment service** | small Python **FastAPI + ONNX Runtime** service (or HF Inference API); routes by `source_type`: FinBERT (`ProsusAI/finbert` or `yiyanghkust/finbert-tone`) for news/filings; `cardiffnlp/twitter-roberta-base-sentiment-latest` (or `ElKulako/cryptobert` for crypto social) for tweets/reddit; VADER fallback in-process | Node calls it over HTTP with batching + timeout + fallback; p95 < 300ms/batch |
| **Content-hash cache** | `SentimentCache` keyed by `sha1(text_clean)` → `{score,label,relevance,entities,event_type,impact,model,model_version,scored_at}`; every unique doc scored once ever | cache hit-rate >80% in steady state |
| Target-aware scoring | score sentiment *toward the resolved entity*, not the whole text (windowed context around the mention / aspect model) | "NVDA soars as INTC stumbles" yields opposite scores per ticker |
| Event classification | news/filings → {earnings beat/miss, guidance, M&A, regulatory, litigation, product, macro, insider buy/sell, none}; LLM (Claude Haiku / GPT-4o-mini) batch, cached | events attached to docs; high-impact events flagged |
| Market-impact / novelty | is this new info or a rehash of an already-scored story? (similarity to recent docs) | rehashes down-weighted |
| **Feature store** | job aggregates scored docs → `SentimentFeatures{asset, bucket_start, bucket_size, source_breakdown, doc_count, abnormal_volume_z, sentiment_weighted, sentiment_dispersion, bull_bear_ratio, sentiment_ewma_fast/slow, momentum, breadth, event_flags, news_retail_divergence, updated_at}` | serving layer reads only this collection; trend/correlation/signal all derive from it |
| Aggregation rules | engagement-weighted × credibility-weighted × recency-decayed mean; require `doc_count ≥ k` before emitting; robust aggregate (trimmed mean); widen window automatically if sparse | sparse assets return `unavailable`, not noise |
| Backfill loaders | GDELT (news, 2015+) + Binance/Tiingo (prices) + Reddit historical (Arctic Shift / academic dumps) → `research/*.parquet` | ≥2 years of aligned news+price history for ≥5 assets |

### M4 — Backtesting + signal v2 (≈3–5 weeks)

| Task | Detail | Exit criteria |
|---|---|---|
| Alignment engine | for each signal time `t`: features from data with `timestamp ≤ t` (+ publish→availability lag); label = forward return over `h ∈ {1h,4h,1d}`; execution at next bar open | no look-ahead; documented lag model |
| Walk-forward harness | chronological train/val/test; expanding-window retrain; test touched once; seeded + reproducible | one command → tearsheet |
| Costs & benchmarks | commission + half-spread + slippage (crypto ~5–10bps, equities ~1–5bps + spread) + latency + borrow; benchmarks: buy-hold, random@turnover, sentiment-only, price-momentum-only | strategy compared net, OOS, vs all four |
| Metrics & calibration | CAGR, Sharpe, Sortino, maxDD, Calmar, hit rate, profit factor, turnover, exposure; classifier: P/R/F1 per class, ROC-AUC, **reliability diagram + Brier score**; regime slices (bull/bear/hi-vol/lo-vol/earnings) | full tearsheet artifact in CI (scheduled) |
| Real rolling correlation | replace M0 relabel with actual rolling Pearson/Spearman over N aligned pairs; report `r`, `n`, CI; contemporaneous vs lead/lag | correlation panel shows honest stats |
| Bias audit | documented checks: look-ahead, survivorship (delisted tickers/dead coins), leakage (learned components fit on train only), selection (report on a randomised universe), multiple-testing (config count disclosed) | written bias section in `research/` |
| **Signal v2** | logistic regression (or shallow GBM) on ≤8 standardised features → calibrated `P(forward return > threshold)`; neutral band; keep rule engine as baseline; ship whichever wins OOS after costs | decision recorded; if no edge → UI says "illustrative", ships rules, states it |
| Credibility re-weighting | use lead/lag results to set source weights empirically | weights updated from evidence |
| Golden-file tests | snapshot signal output over a fixed feature set → catches logic drift | test in CI |

### M5 — Frontend v2 (≈2–4 weeks, overlaps M3–M4)

| Task | Detail |
|---|---|
| Price ↔ sentiment overlay | dual-axis chart (the actual product thesis); lead/lag annotation |
| Explain-this-signal drawer | show the score components, the driving headlines/posts, per-source contribution |
| Source breakdown panel | sentiment by source class (news vs StockTwits vs Reddit), divergence highlight |
| States | per-panel loading / empty / error / stale; connection tri-state; number formatting (`Intl.NumberFormat`) |
| Accessibility | ARIA on gauge/controls; keyboard-navigable dropdown (arrow/Esc/`role=listbox`); icons+text not colour alone; `prefers-reduced-motion`; jest-axe in CI |
| Methodology page | interactive: every formula, every source, credibility weights, known limitations, backtest tearsheet embedded, "what's simulated right now" |
| Watchlist / multi-asset compare | low-risk, high perceived value |

### M6 — Hardening & optional scale (as needed)
Redis socket adapter (only if `numInstances>1`), event-catalyst UI, alert delivery (needs accounts), regime model, prom-client + Grafana Cloud, Google-Trends/LunarCrush paid add-ons, X/Twitter enablement.

---

## 5. Deep dive: the multi-source data pipeline

### 5.1 Target pipeline architecture

```mermaid
flowchart TB
  subgraph Connectors["Source connectors (common interface, per-source limiter + retry + breaker)"]
    N1[NewsAPI]
    N2[Marketaux / AlphaVantage]
    N3[Finnhub company-news]
    N4[RSS: Reuters/CoinDesk/EDGAR]
    S1[StockTwits streams]
    S2[Reddit OAuth]
    S3[X / Twitter  — flagged off]
    F1[SEC EDGAR filings]
    D1[Fear&Greed / Wikipedia / Trends]
  end

  subgraph Queue["BullMQ (Redis) — repeatable jobs per source"]
    SCHED[Scheduler: per-source cadence + adaptive polling]
  end

  Connectors --> SCHED --> NORM

  subgraph Pipeline["Processing stages"]
    NORM[1 Normalize → canonical SentimentDocument]
    LANG[2 Language filter]
    ENT[3 Entity resolution → asset universe]
    REL[4 Relevance scoring → drop passing mentions]
    BOT[5 Bot / spam filter → author_quality]
    DEDUP[6 Exact + near-dup collapse across sources]
    SENT[7 Sentiment scoring — model routed by source_type, hash-cached]
    EVENT[8 Event classification + impact/novelty]
  end

  NORM --> LANG --> ENT --> REL --> BOT --> DEDUP --> SENT --> EVENT --> AGG

  subgraph Storage
    RAW[(Mongo TS: raw docs, TTL 90d)]
    CACHE[(SentimentCache by content hash)]
    FEAT[(SentimentFeatures: per asset / per bucket rollups)]
    PARQ[(research/*.parquet — backtest only)]
  end

  EVENT --> RAW
  SENT <--> CACHE
  AGG[9 Aggregation job → feature store] --> FEAT
  RAW -. nightly export .-> PARQ

  subgraph Serving["Express + Socket.io (read-only)"]
    API[/api/v1/*]
    WS[socket rooms per asset:range]
    SIG[Signal engine — reads FEAT]
  end

  FEAT --> API & WS & SIG
```

### 5.2 Source catalogue

| Source | Class | Cost / limit | Why it matters for markets | Priority |
|---|---|---|---|---|
| **Marketaux** *or* **Alpha Vantage NEWS_SENTIMENT** | news | free ~100/day or 25/day; paid ~$30–50/mo | built-in entity tagging + relevance + sentiment — a good canonical target shape | M1 |
| **Finnhub** company-news | news | free 60 req/min, ~1yr US history | per-ticker, fast, generous free tier | M1 |
| **NewsAPI** | news | free 100/day (no prod ToS) | broad coverage; demoted to one-of-many | M1 (already integrated) |
| **GNews / NewsData.io** | news | free 100–200/day | redundancy / breadth | M2 opt |
| **RSS** (Reuters, CoinDesk, The Block, MarketWatch, SEC) | news/filing | free, unlimited | zero-quota baseline; primary-source speed | M1 |
| **GDELT** GKG | news (historical) | free, 15-min files, 2015+ | the realistic free backfill for backtesting | M3 |
| **StockTwits** | retail social | free public streams (~200/hr/IP; verify partner-key status) | finance-native, cashtags, **native Bull/Bear labels**, real retail positioning | M2 |
| **Reddit** | forum social | free tier ~100 req/min OAuth (non-commercial) | WSB/crypto subs move small caps and memes; mention velocity is a known factor | M2 |
| **X / Twitter** | broad social | Basic $200/mo (~15k posts/mo) or reseller | fastest breaking sentiment; also noisiest, bot-heavy | deferred, flagged |
| **SEC EDGAR** | filings | free (User-Agent required) | 8-Ks are among the largest single-name movers | M2 |
| **CNN Fear & Greed** (equities) / **alternative.me** (crypto) | derived | free JSON | market-wide risk appetite regime input | M2 |
| **Wikipedia pageviews** | attention | free REST | retail attention proxy (academic-supported) | M2 |
| **Google Trends** | attention | unofficial, flaky | search interest; best-effort daily | M2 opt |
| **LunarCrush** | crypto social+onchain | paid ~$29/mo | aggregated crypto social metrics | M6 opt |
| **Earnings-call transcripts** (Finnhub / API Ninjas) | filings-ish | free-ish | management-tone sentiment around earnings | M6 opt |

### 5.3 Canonical schema (`SentimentDocument`)

```jsonc
{
  "id": "stocktwits:msg:6543210",
  "source": "stocktwits",
  "source_type": "social",              // news | social | forum | filing | derived
  "url": "https://stocktwits.com/...",
  "author": { "handle": "trader_x", "followers": 812, "account_age_days": 40,
              "quality": 0.31, "is_suspected_bot": false },
  "text_raw": "$AAPL breaking out, load the boat 🚀",
  "text_clean": "AAPL breaking out load the boat",
  "lang": "en",
  "published_at": "2026-09-09T14:31:00Z",   // validated / clamped
  "ingested_at":  "2026-09-09T14:33:12Z",
  "entities": [ { "symbol": "AAPL", "name": "Apple", "salience": 0.95, "mentions": 1,
                  "match_type": "cashtag" } ],
  "relevance": 0.88,
  "engagement": { "likes": 12, "replies": 3, "reshares": 1, "upvotes": null, "views": null },
  "native_sentiment": { "label": "bullish", "source": "stocktwits_tag" },  // if provider supplies one
  "dedupe_key": "simhash:9f3a...e21",
  "cluster_id": "clu_20260909_aapl_breakout",   // near-dup cluster
  "provider_payload": { /* raw, for reproducibility */ },
  "scores": {                              // filled by stage 7–8, from cache
    "model": "twitter-roberta-base", "model_version": "2024.04",
    "sentiment": 0.61, "label": "positive",
    "event_type": "none", "impact": 0.2, "novelty": 0.7,
    "scored_at": "2026-09-09T14:33:20Z"
  }
}
```

### 5.4 Stage-by-stage rules

**1. Normalize** — pure mapping per source; never lose the raw payload. Reject docs with no usable text or no valid timestamp.

**2. Language** — keep `en` for v2 (detector, not just the provider's flag). Non-en → store but exclude from aggregation.

**3. Entity resolution** — the highest-leverage stage.
- Per-asset **gazetteer**: `{ symbol, legal_name, common_names[], cashtag, aliases[], misspellings[], products[], slang[] }` (e.g. BTC: "bitcoin", "$BTC", "the king", "orange coin"; NVDA: "nvidia", "$NVDA", "team green", "jensen").
- Fast multi-pattern match (Aho-Corasick / flashtext).
- **Ambiguity guards**: bare `V`, `SNAP`, `ETH`-as-a-word, `META` (the concept) require a `$` cashtag or a company-context term; otherwise unresolved.
- Output `salience` (how central the asset is to the doc) — feeds relevance and aggregation weight.

**4. Relevance** — is the doc *about* the asset or just name-drops it? Cosine similarity of the doc embedding to the asset description, or a small binary classifier. Drop below threshold **before** aggregation. Measured on a hand-labelled set.

**5. Bot / spam filter (social/forum only)** — heuristic score from: account age, follower/following ratio, posting cadence, duplicate-text bursts across accounts, promo-link density, emoji/hashtag spam ratio, coordinated timing clusters. Output `author_quality ∈ [0,1]`; drop the obvious, down-weight the rest.

**6. Dedup** — exact by content hash; near-dup by **SimHash + Hamming threshold** (or MinHash+LSH) over a rolling 48h window, across all sources. Collapse a cluster into one document whose engagement is the sum and whose credibility is the max — a wire story on 20 sites is one event, not 20.

**7. Sentiment scoring** — routed by `source_type`, results cached by `sha1(text_clean)`:
- news / filing → **FinBERT**
- social / forum → **twitter-roberta** (equities) or **CryptoBERT** (crypto)
- fallback → VADER (flagged)
- **target-aware**: score the window around the resolved mention, not the whole doc.

**8. Event & impact** — LLM batch classifier (cached): `event_type`, `impact` (0–1), `novelty` (0–1 vs recent docs). High-impact + high-novelty docs get an aggregation boost and can trigger an out-of-cycle snapshot.

**9. Aggregation → feature store** — per asset, per bucket (5m/15m/1h):

```
weight(doc) = credibility[source]           // 0.2 – 1.0
            * (0.3 + 0.7 * relevance)
            * (0.3 + 0.7 * author_quality)   // social only, else 1
            * recency_decay(published_at)     // half-life ~ bucket size
            * (1 + 0.5 * impact)              // events count more

sentiment_weighted   = Σ weight·sentiment / Σ weight     (trimmed mean)
sentiment_dispersion = weighted stdev                     (disagreement)
bull_bear_ratio      = native + modelled bull / bear
abnormal_volume_z    = (doc_count − μ_trailing) / σ_trailing
breadth              = fraction of source classes net-positive
news_retail_divergence = sentiment(news) − sentiment(social)
momentum             = EWMA_fast − EWMA_slow
event_flags          = { earnings, m&a, regulatory, ... } present in window
```

Emit a bucket only if `doc_count ≥ k` (per source class minimums); otherwise widen the window, then `unavailable`.

### 5.5 Storage & retention

| Collection | Contents | Retention | Index |
|---|---|---|---|
| `raw_documents` (time-series) | full `SentimentDocument` | TTL 90d | `{asset:1, published_at:-1}`, `{dedupe_key:1}` unique |
| `sentiment_cache` | hash → scores | TTL 180d (refresh on hit) | `{_id}` = hash |
| `sentiment_features` | per asset/bucket rollups | 2y | `{asset:1, bucket_start:-1, bucket_size:1}` |
| `source_health` | per-source last-ok, error rate, quota used | 30d | `{source:1, ts:-1}` |
| `research/*.parquet` | historical, aligned | permanent (cold) | — file per asset/month |

### 5.6 Rate-limit, cost & resilience

- **Per-source token-bucket limiter** + a daily request/cost ceiling; alert at 80%, hard-stop at 100% (source goes `degraded`, others carry on).
- **Circuit breaker** (`opossum`) per source: open on error-rate → skip that source's jobs, surface in `/api/ready` and metrics.
- **Adaptive polling**: increase cadence when `abnormal_volume_z` or realised volatility is high; back off when quiet — spend quota where it matters.
- **Graceful degradation**: aggregation renormalizes weights over whatever sources are healthy; the feature record lists which sources contributed (`source_breakdown`), and the UI shows it.
- No source is ever load-bearing alone.

### 5.7 Backfill for backtesting

| Data | Source | Notes |
|---|---|---|
| Historical news | **GDELT GKG** (free, 2015+) + Alpha Vantage (limited) + optional paid Marketaux/Benzinga | GDELT tone + themes is enough to reconstruct a news-sentiment series |
| Historical prices | **Binance klines** (crypto, minute, years) + Tiingo/Stooq (equities daily) + Polygon (paid, intraday equities) if needed | free path covers crypto fully |
| Historical Reddit | **Arctic Shift** / academic dumps | submissions + comments with scores |
| Historical Twitter | mostly unavailable → **start collecting live in M1**; accept a shorter social backtest window | this is why ingestion ships first |
| Historical filings | EDGAR full archive (free) | complete |

Backfill runs offline into Parquet; the backtest never touches live Mongo.

### 5.8 Pipeline observability

Metrics: `ingest_docs_total{source,outcome}`, `provider_errors_total{source}`, `provider_quota_used_ratio{source}`, `dedup_collapse_ratio`, `entity_resolution_unmatched_ratio`, `relevance_drop_ratio`, `bot_drop_ratio`, `sentiment_cache_hit_ratio`, `feature_buckets_emitted_total{asset}`, `feature_bucket_unavailable_total{asset}`, `pipeline_lag_seconds{stage}`.
Alerts: any source `degraded` > 30 min, quota > 80%, `pipeline_lag` > 2× cadence, `feature_bucket_unavailable` spike, entity-unmatched ratio regression, `mock_served_in_production > 0`.

---

## 6. How the pipeline feeds signal v2

```
sentiment_features (per asset/bucket)
   ├─ sentiment_weighted, dispersion, momentum        ─┐
   ├─ abnormal_volume_z, breadth                       │
   ├─ bull_bear_ratio (StockTwits native + model)      ├─►  feature vector at time t
   ├─ news_retail_divergence                           │     (only data ≤ t)
   ├─ event_flags / impact                             │
   └─ from market-data service:                        │
        log return, realised vol, rolling r(sent,ret) ─┘
                                                        │
                          walk-forward backtest ◄───────┤
                          calibrated model / rule baseline
                                                        ▼
                    signal {bias, strength(qualitative), drivers[], as_of}
```

The signal never sees raw documents — only the feature store — which keeps it reproducible and the backtest honest.

---

## 7. Sequencing (rough calendar, solo/part-time)

```
Month 1   ── M0 (wk1) ──────── M1 ingestion + real prices + CI ───────────────
Month 2   ── M1 finish ── M2 sources (StockTwits, Reddit, EDGAR) + entity/dedup/bot ──
Month 3   ── M2 finish ── M3 sentiment service + feature store + backfill ──────
Month 4   ── M3 finish ── M4 backtest harness + signal v2 ─────────────────────
Month 5   ── M4 finish ── M5 frontend v2 (overlay, explain, a11y, methodology) ─
Month 6   ── polish, M6 optional add-ons, X/Twitter decision ──────────────────
```

Critical path: **M1 ingestion platform** gates everything (M2 sources plug into it, M3 needs docs, M4 needs M3 features, M5 visualises M4). Ship M0 and start M1 immediately so social history begins accumulating.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| StockTwits / Reddit tighten free access mid-build | connector interface isolates the blast radius; RSS + news providers keep the product alive; budget line for a paid fallback |
| Twitter cost | deferred behind a flag; StockTwits covers the "retail social" role for free |
| Social sentiment is reflexive (reacts to price, doesn't lead) | M4 lead/lag analysis explicitly tests this; if a source doesn't lead, its weight → low and the UI says "coincident, not predictive" |
| Backtest shows no edge | that's an acceptable, honest outcome — ship the rule baseline labelled "illustrative"; the rigor itself is the portfolio value |
| Scope creep from 10+ sources | M2 hard-caps at StockTwits + Reddit + EDGAR + Fear&Greed + Wikipedia; everything else is M6-optional |
| Python sentiment service adds ops burden | keep it one small container on the same host; VADER fallback means an outage degrades, not breaks |
| Redis introduced "against" the audit's advice | justified by the ingestion queue + cache, not by scale; documented; still single-instance |

---

## 9. Not in v2 (explicit cuts)

Kafka / RabbitMQ · Kubernetes · microservices · GraphQL · multi-region · real trading / brokerage · user accounts & auth (unless watchlist persistence forces a minimal version in M5) · alert delivery · mobile apps · i18n · Discord/Telegram scraping · paid enterprise news (Benzinga/RavenPack) · custom transformer training · LLM fine-tuning · a strategy-builder UI · options/derivatives flow · portfolio/risk tooling.

---

## 10. Tech added in v2

| Need | Choice | Justification |
|---|---|---|
| Job queue / scheduler | **BullMQ + Redis** | reliable repeatable ingestion jobs, retries, backoff, DLQ |
| Cache | Redis (same instance) | sentiment/feature/snapshot cache; later socket adapter |
| Sentiment models | **FastAPI + ONNX Runtime** service (FinBERT, twitter-roberta, CryptoBERT); HF Inference API as alt | source-appropriate accuracy at low cost/latency |
| Event classification | LLM batch (Claude Haiku / GPT-4o-mini), cached | one call does event type + impact + novelty |
| Entity matching | `aho-corasick` / flashtext + gazetteer | fast, deterministic, debuggable |
| Near-dup | SimHash (or MinHash+LSH) | cross-source dedup |
| Market data | Binance SDK + Alpaca/Finnhub/Tiingo client | real prices + calendar |
| Backtest / research | Python: pandas + `vectorbt` (or custom) + DuckDB/Parquet | standard, reproducible, offline |
| Validation / contracts | `zod` (shared FE/BE) | request + response schemas |
| Logging / errors / uptime | pino + Sentry + UptimeRobot | lean observability |
| CI | GitHub Actions | lint/test/build/audit gate |

Everything else stays: React/Vite/Tailwind, Chart.js (+ `lightweight-charts` for the overlay), Express, Socket.io, MongoDB Atlas, Render/Vercel.

---

*End of v2 roadmap. Awaiting approval of milestones, source list, and budget before implementation.*
