# SentiTrade — Production Readiness Audit

> Deep technical audit based on reading the actual repository at `main` (commits `fe80825`, `5bfab20`), not the README claims.
> Scope: full stack — `backend/` (Express + Mongoose + Socket.io + VADER), `frontend/` (React + Vite + Tailwind + Chart.js), deployment (`render.yaml`, Vercel), data pipeline, quant logic.
> Status: **discussion draft — no code changes made.**

---

## 0. What the code actually is (traced end-to-end)

**Data flow as implemented:**

```
GET /api/sentiment?asset=BTC&range=1h
  └─ sentimentController.getSentiment
       ├─ newsService.getLatestSentiment(asset, 20, refresh=true)   ← refresh defaults TRUE
       │    ├─ fetchAndStoreNews
       │    │    ├─ if !NEWS_API_KEY            → makeMockNews()  (6 hardcoded headlines)
       │    │    ├─ axios GET newsapi.org/v2/everything?...&apiKey=KEY  (timeout 9s)
       │    │    ├─ on error / empty            → makeMockNews()
       │    │    └─ else persistHeadlines()  → N× findOneAndUpdate upsert
       │    ├─ if Mongo up: re-query NewsSentiment.find({asset}).sort(-timestamp).limit(20)
       │    ├─ if still empty                   → makeMockNews()
       │    └─ averageSentiment(items) → score_avg, score_percent, label
       ├─ correlationService.getCorrelationInsight(asset, range)
       │    ├─ newsService.getSentimentTrend      → Mongo $group by minute, OR makeMockTrend()
       │    └─ priceService.getPriceChange
       │         └─ getPriceSeries
       │              ├─ 60s in-proc Map cache
       │              ├─ if ENABLE_LIVE_PRICE_API==='true' AND type==='crypto' → CoinGecko
       │              └─ else / on error / stocks always → makeMockPriceSeries()  (sine waves)
       ├─ signalService.generateTradeSignal({sentiment, correlation})  → BUY/SELL/HOLD + confidence
       └─ summaryService.createMarketSummary()  → prose string

Socket.io: on connect + on 'asset:change' + every 30 000 ms  → emitSnapshot(socket) (per-socket setInterval)
Frontend: REST loadDashboard() on mount + on asset/range change  AND  socket 'sentiment:update' both write the same state
```

**The load-bearing fact:** in the **default deployed configuration** (`render.yaml` sets `ENABLE_LIVE_PRICE_API=false`), **every price number in the product is synthetic**, and news degrades silently to a fixed 6-headline script whenever NewsAPI is unavailable or over quota. The only genuinely live element is the TradingView chart iframe, which visually legitimises the fabricated numbers beside it.

---

## 1. Executive Verdict

**Production readiness (as a financial-signal system for real users): 24 / 100.**
**As a hackathon demo / portfolio visual-design piece: ~70 / 100.**

| Dimension | Score /10 | Note |
|---|---|---|
| Code organisation / readability | 7 | Clean layered structure, small files, consistent style. Genuinely good for its size. |
| Architecture soundness | 4 | Reasonable layering; request-coupled ingestion, per-socket timers, no jobs, no cache tier. |
| Data integrity / honesty | 1 | Silent synthetic fallback presented as live data with a fresh timestamp. This is the core problem. |
| Quant / signal validity | 1 | "Correlation" is `sign(Δa)==sign(Δb)` on 2 points; confidence is invented; zero backtesting. |
| AI / sentiment quality | 3 | VADER on headline titles only; no relevance, no entity attribution, wrong for finance vocabulary. |
| Security | 3 | 11–12 known-vuln deps, secret-leak-to-logs vector, weak DB creds on disk, no input validation. |
| Reliability / resilience | 3 | No retries/circuit breakers, swallowed DB failure, fake health check, NewsAPI quota unprotected. |
| Observability | 1 | `console.log` only. No metrics, no error tracking, no "served mock" counter, no alerting. |
| Testing | 0 | Zero tests, zero CI, zero lint. |
| DevOps / deploy | 4 | `render.yaml` + Procfile + env templates exist; no CI, loose Node pin, free-tier cold-start issues. |
| Frontend UX polish | 6 | Looks like a fintech product; missing states, a11y, freshness/simulated indicators, disclaimer. |
| Documentation | 5 | README is thorough but **overclaims** ("production-grade", "predicts", "correlation"). |

Why 24 and not lower: the scaffolding (layering, deploy config, helmet/rate-limit/compression, graceful-shutdown stub, mock-mode for offline demo) shows the author knows the *shape* of a production app. Why not higher: the product's central promise — "sentiment vs price signal you can act on" — is not backed by real data or any validation, and it doesn't tell the user that.

---

## 2. Production Readiness Audit — findings by severity

Format: **Problem · Why it matters · Where · Impact · Fix · Priority · Complexity (S/M/L)**

### A. CRITICAL

**A1 — Price data is 100% synthetic in every default deployment**
- Why: `render.yaml:21` sets `ENABLE_LIVE_PRICE_API=false`; `priceService.getPriceSeries` only calls CoinGecko when that flag is `'true'` **and** `type==='crypto'`. Stocks have no `coingeckoId` and therefore **never** have a live source. So `price_change`, `current_price`, the "Price Move" tile, the correlation verdict, and the price term of the signal all come from `makeMockPriceSeries` — `Math.sin`/`Math.cos` of an integer index, seeded by a hash of the ticker.
- Where: `backend/src/services/priceService.js:32-59`, `mockDataService.js:225-250`, `render.yaml:21-22`.
- Impact: The dashboard shows fabricated price action as fact (`"current_price": 67350`), and because the series is a deterministic function of the symbol, the numbers **never change** between refreshes for a given asset/range. Any user who cross-checks against the real chart above it will see they disagree.
- Fix: Add real providers — Binance klines for crypto (free, no key), Alpaca/Tiingo/Finnhub for stocks. When live data is genuinely unavailable, return an explicit `price_source: "unavailable"` and render an empty/stale state — never a plausible fake. Remove the `ENABLE_LIVE_PRICE_API=false` default in production.
- Priority: P0 · Complexity: M

**A2 — News silently falls back to a fixed 6-headline script, presented as live**
- Why: `fetchAndStoreNews` returns `makeMockNews()` when `NEWS_API_KEY` is missing, when axios throws, when the response is empty, or (in practice) once the NewsAPI free plan's **100 requests/day** quota is exhausted. `getLatestSentiment` then stamps `updatedAt: new Date().toISOString()` regardless, so canned data looks freshly fetched.
- Where: `newsService.js:59-110`, `mockDataService.js:4-193`.
- Impact: On Render, a single open browser tab issues ~2 NewsAPI calls/min (mount + 30s socket ticks, `refresh` defaulting true), so the daily quota is gone in <1 hour; the rest of the day every visitor sees the same 6 fake headlines with live-looking timestamps and a "live socket connected" badge. Judges/reviewers/interviewers will assume it's real.
- Fix: (1) Move ingestion to a scheduled job, not per-request (`refresh` should almost never be true on a read). (2) Cache aggressively. (3) In production, if news is unavailable, show "headlines unavailable" — do not synthesise. (4) Every fallback path must set `data_source: "simulated"` in the payload and the UI must badge it.
- Priority: P0 · Complexity: M

**A3 — No "simulated / stale" indicator anywhere in the UI**
- Why: The API never tells the client whether a value is live, cached, or mock; the UI has no affordance for it. The real TradingView chart sits directly beside fabricated metrics, transferring its credibility to them.
- Where: entire `frontend/src`, all service responses.
- Impact: Users cannot distinguish a working system from a broken one. For a product that outputs BUY/SELL, this is a trust and arguably a consumer-protection problem.
- Fix: Thread a `data_source` / `as_of` / `is_stale` field through every response; render a small badge on each panel ("live", "delayed 4m", "simulated"). Global banner when any panel is simulated.
- Priority: P0 · Complexity: S–M

**A4 — "Correlation" is not correlation**
- Why: `correlationService.getCorrelationInsight` takes the **first and last** point of the sentiment trend and the **first and last** price, computes each delta, and reports "Positive correlation detected" iff `sign(Δsentiment)===sign(Δprice)` with `|Δsentiment|≥2` and `|Δprice|≥0.15`. That is co-movement of two endpoints (n = 2), not a correlation coefficient — no Pearson/Spearman, no lag, no window of paired observations, no significance, no sample size.
- Where: `correlationService.js:6-31`.
- Impact: The single most misleading element. It implies a measured statistical relationship that was never computed. With mock data, both series are deterministic functions of the ticker, so the "insight" is a **fixed constant per asset/range** that never updates — yet it's shown as a live market read, and it feeds 2 points into the signal score.
- Fix: Compute a real rolling correlation over N paired, time-aligned observations; report `r`, `n`, and a confidence interval; label honestly ("sentiment and price co-moved over the last hour, r=0.31, n=42 — not predictive"). Distinguish *contemporaneous co-movement* from *lead/lag*. See §3 and §16.
- Priority: P0 · Complexity: M

**A5 — "Confidence" is a fabricated number with no probabilistic meaning**
- Why: `signalService.js:66-68`: `confidence = clamp(45..92, 45 + |score|*7 + min(total,20)*0.6 − conflictPenalty)`. It is a rescaled function of the rule score and headline count. It has never been calibrated against outcomes; "77% confidence" does not mean the call is right 77% of the time.
- Where: `signalService.js:60-68`.
- Impact: Users read "77% confidence" as a probability. It isn't one. This is the kind of wording that turns "educational demo" into "misleading financial product".
- Fix: Either (a) drop the number and show a qualitative strength ("weak / moderate / strong signal alignment"), or (b) calibrate a real probability from a backtest and show a reliability diagram. Until (b) exists, do (a).
- Priority: P0 · Complexity: S (to remove) / L (to do properly)

**A6 — Disclaimer exists in the API but is never shown to the user**
- Why: `signalService` returns `disclaimer: "Educational signal only. Not financial advice."` — `grep` confirms **no frontend file renders it**. `CorrelationBox` and `MarketMetrics` render the signal, confidence, and reasons, but not the disclaimer.
- Where: `signalService.js:86`; absent from `frontend/src/components/*`.
- Impact: The product displays BUY/SELL + a confidence % + "Momentum alert" with zero visible disclaimer. See §15.
- Fix: Persistent, visible disclaimer near every signal and in the footer; a "Methodology" page; remove predictive language.
- Priority: P0 · Complexity: S

**A7 — Secret leakage into logs via raw error objects**
- Why: `app.js:55` global handler does `console.error(error)`. Axios errors serialise `error.config.url`, which for NewsAPI is `https://newsapi.org/v2/everything?...&apiKey=<NEWS_API_KEY>`. `newsService.js:75` logs `error.message` (safer) but the global handler and any rethrow dump the whole object.
- Where: `app.js:54-61`, `newsService.js:74-77`, `priceService.js:50-52`.
- Impact: `NEWS_API_KEY` (and potentially Mongo error strings) land in Render's log stream, which is retained and viewable by anyone with dashboard access.
- Fix: Never log error objects raw. Log `{ msg, name, status: err.response?.status, code }` via a structured logger with a redaction serializer. Pass the API key as a header or use a client that redacts.
- Priority: P0 · Complexity: S

**A8 — Weak MongoDB credentials on disk + `0.0.0.0/0` guidance**
- Why: `backend/.env` (correctly git-ignored, and **not** in the 2-commit history — good) contains `mongodb+srv://sentiTrade:sentiTrade@...` — username equals password equals the project name — and a live `NEWS_API_KEY`. README §Pre-Deployment tells users to allowlist `0.0.0.0/0`.
- Where: `backend/.env` (local), `README.md:553`.
- Impact: If that Atlas cluster is real and network-open, the database is effectively public with a guessable login. The NewsAPI key is also now exposed (it was read during this audit).
- Fix: Rotate both credentials now. Use a generated 32-char DB password, a least-privilege DB user, and restrict Atlas network access to Render's egress IPs (or PrivateLink). Add `gitleaks` to CI so a future `.env` commit is caught.
- Priority: P0 · Complexity: S

**A9 — 11–12 known-vulnerable dependencies (`npm audit`)**
- Why: `backend`: 11 vulns (6 high) — `ws` (uninitialised memory disclosure, DoS), `socket.io-parser` (memory-exhaustion DoS). `frontend`: 12 vulns (8 high) — same `ws` chain via `engine.io-client`.
- Where: `backend/package.json`, `frontend/package.json` (transitive).
- Impact: Remotely exploitable DoS / memory disclosure on the Socket.io endpoint, which is unauthenticated and public.
- Fix: `npm audit fix`, bump `socket.io`/`socket.io-client` to patched minors, add Dependabot or Renovate, add `npm audit --audit-level=high` to CI.
- Priority: P0 · Complexity: S

**A10 — Health check is fake; degraded instances stay in rotation**
- Why: `/api/health` returns the string `"Server running"` with 200 unconditionally (`healthController.js`). It does not check Mongo or providers. `render.yaml:9` uses it as the health check path.
- Where: `healthController.js`, `render.yaml:9`.
- Impact: Render considers the app healthy while Mongo is down and every response is mock. No automatic restart, no alert.
- Fix: Split `/api/health` (liveness — process up) from `/api/ready` (readiness — Mongo `readyState===1`, last successful provider fetch recent, mock-fallback-rate low). Point Render at `/api/ready`. Alert on ready-fail.
- Priority: P0 · Complexity: S

### B. HIGH

**B1 — Zero tests, zero CI, zero lint.** No test runner, no `.github/workflows`, no ESLint/Prettier config. Nothing prevents a regression in the signal math or the CORS logic from shipping. → Add Vitest + supertest + mongodb-memory-server + Playwright + GitHub Actions. See §11. · P1 · L

**B2 — Ingestion coupled to HTTP requests.** `refresh` defaults `true` on `GET /api/sentiment` and every socket tick. Should be a `node-cron` job writing to Mongo; reads should only read. → Decouple. · P1 · M

**B3 — Per-socket 30s timers, no shared snapshot.** `socketService.js:52` creates a `setInterval` per connection, each doing a full news+correlation+signal recompute. 10 clients = 10× provider load every 30s. → One server-side scheduler per active `(asset,range)`, cache the snapshot, `io.to(room).emit()`. See §8. · P1 · M

**B4 — REST and socket both populate the same state.** `Dashboard.jsx` calls `loadDashboard()` **and** listens for `sentiment:update`; both `setSentiment`. Double provider hits on load, and a race decides which value wins. → Pick one channel for the live data (socket) and use REST only for the initial paint or as fallback. · P1 · M

**B5 — No input validation.** `limit = Number(req.query.limit || 20)` → `NaN` for `?limit=abc` → `.limit(NaN)`. `range` is any string. No schema layer. (NoSQL injection is *mostly* blocked because `asset` is whitelisted through `normalizeAsset`, but relying on that is fragile.) → `zod` on every query; reject bad input with 400. · P1 · S

**B6 — Unbounded collection growth.** No TTL index on `NewsSentiment.timestamp`. README claims a "retention strategy" — there is none. → TTL index (30–90d) + a rollup collection for the trend. · P1 · S

**B7 — Dedup key is the full headline string.** `index({text:1, asset:1}, {unique:true})`. Near-duplicates (different outlet re-wording the same wire story, trailing punctuation, "— Reuters" suffixes) each create a row and each gets counted in the average. Indexing multi-hundred-byte strings is also wasteful. → `dedupeKey = sha1(normalizedTitle)`, unique index on that; optional SimHash/embedding near-dup pass. · P1 · M

**B8 — `persistHeadlines` does N sequential-ish upserts.** `Promise.all(items.map(findOneAndUpdate))` = up to 20 round-trips per fetch. → `bulkWrite` with `updateOne` + `upsert`. · P1 · S

**B9 — DB connection failure is swallowed.** `db.js` catches, logs, returns `false`; the app boots into permanent mock mode with no alarm. → In production, fail fast (exit non-zero so Render restarts) or emit a loud metric + alert; never serve mock silently. · P1 · S

**B10 — Graceful shutdown is incomplete.** `app.js:74` calls `server.close()` only — Socket.io connections and the Mongoose pool are not drained, and there's no forced-exit timeout, so SIGTERM can hang until Render kills it. → Close `io`, `mongoose.connection`, add a 10s `setTimeout(process.exit(1))`. · P1 · S

**B11 — Trend aggregation is high-variance noise.** `$group` by exact minute over NewsAPI `publishedAt` timestamps → mostly `count:1` buckets, jagged line. `sentiment_change` uses only the first and last bucket → dominated by endpoint noise. → Wider buckets (5–15m), require `count≥k`, smooth (EWMA), compute change as a slope/regression not endpoints. · P1 · M

**B12 — Mock/live behaviour diverges.** Mock trend/price cap at `Math.min(minutes,240)`; the live aggregation path uses the full 1440 for `24h`. Series length, smoothness, and `sentiment_change` scale differ between "demo" and "real". → One code path, one windowing rule. · P1 · S

**B13 — No caching tier for sentiment.** Only `priceCache` (in-proc `Map`, 60s, lost on restart, not shared). Sentiment/trend/correlation are recomputed every call. → `lru-cache` now, Redis when multi-instance. · P1 · S

**B14 — Frontend: no ErrorBoundary, StrictMode removed.** README brags about removing `StrictMode` "to avoid socket noise" — that masks real effect/cleanup bugs. No ErrorBoundary means one render throw = white screen. → Restore StrictMode and fix the underlying double-mount handling; add an ErrorBoundary. · P1 · S

**B15 — Socket update filtered by asset but not range.** `Dashboard.jsx:100` drops updates where `asset` mismatches but accepts stale-`range` payloads → chart/metrics can show 24h data while the UI says 5m. → Filter on both. · P1 · S

**B16 — CoinGecko integration is half-wired.** `priceService.js:10` `const days = range === "24h" ? 1 : 1;` (dead ternary). Every range fetches a full day and filters. No key header (CoinGecko now often requires a demo key), no retry, no rate-limit handling, no historical beyond 1 day. · P1 · S–M

**B17 — `helmet()` with defaults only.** No CSP, no HSTS tuning. The API is JSON-only so risk is lower, but ship a CSP and `Strict-Transport-Security`. Frontend (Vercel/Render static) has **no** security headers at all — add `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` via `vercel.json`/`_headers`. · P1 · S

### C. MEDIUM

- **C1** No API versioning (`/api/v1`). Breaking changes will break deployed frontends. · P2 · S
- **C2** No structured logging / request IDs / correlation IDs. `pino` + `pino-http`. · P2 · S
- **C3** No error tracking (Sentry free tier, both apps). · P2 · S
- **C4** No uptime / latency monitoring (UptimeRobot / Better Stack on `/api/ready`). · P2 · S
- **C5** `engines: ">=18"` is too loose and Node 18 is EOL (2025). Pin `20.x` via `.nvmrc` + `engines` + `render.yaml` `NODE_VERSION`. · P2 · S
- **C6** No `Dockerfile` — fine for Render, but blocks local parity and portability. · P2 · S
- **C7** No pagination / cursoring on news. · P2 · S
- **C8** `summaryService` overclaims ("reinforcing bullish momentum", "risk-off pressure is still active") from a 2-point comparison. Soften. · P2 · S
- **C9** Free Render plan sleeps after 15 min idle → cold starts, and the per-socket 30s timers die on sleep with no catch-up. Document or upgrade. · P2 · S
- **C10** `express-rate-limit` is global and in-memory; per-instance, resets on deploy, no Redis store. Acceptable now; note it. · P2 · S
- **C11** `compression()` runs before the rate limiter and on all responses (minor BREACH surface on any future authenticated response; negligible today). · P3 · S
- **C12** No `LICENSE` file. · P2 · S
- **C13** Frontend `index.css` loads Google Fonts via `@import` (render-blocking); self-host or `<link rel=preconnect>`. · P3 · S

### D. NICE TO HAVE

Watchlist / multi-asset compare · historical signal log with outcomes · alert delivery (email/web-push) · price-vs-sentiment dual-axis chart · per-source sentiment breakdown · event/catalyst detection · technical-indicator overlay · user accounts + saved preferences · configurable thresholds · light theme · PWA / offline · i18n · CSV export · "explain this signal" drawer.

---

## 3. Quant / signal logic audit

### 3.1 Is the methodology sound? Mostly no — but it is honestly *simple*, and the fix is about framing + validation, not complexity.

| Component | As implemented | Problem | What's needed |
|---|---|---|---|
| Sentiment aggregation | Unweighted mean of VADER compound over last ~20 headlines | No recency weighting, no source weighting, no relevance filter, no dedup beyond exact-match; one off-topic headline moves the mean | Time-decay weight, relevance gate, source credibility weight, robust aggregate (trimmed mean / median), report dispersion |
| Sentiment thresholds | VADER ±0.05; signal bands at 62/55/45/38 % | Arbitrary, unvalidated, not asset-specific; VADER's ±0.05 is a social-media default | Derive bands from the training-set distribution per asset class; validate on held-out data |
| Sentiment momentum | `(last − first)` of per-minute trend, in normalised %-points | 2-point difference on a noisy series; huge variance; not annualised/normalised for window length | Slope of a regression over the window, or EWMA(fast) − EWMA(slow); standardise by window |
| Price movement | `(last − first)/first` of a **synthetic** series (or CoinGecko 1-day, filtered) | Data is fake in prod (A1); even live, 2-point return ignores path/vol; no log returns | Real OHLCV; log returns; realised volatility; multiple horizons |
| Correlation | `sign(Δsent)==sign(Δprice)` on 2 points, thresholded | Not a correlation; n=2; no lag; deterministic constant under mock (A4) | Rolling Pearson/Spearman over N aligned pairs; report r, n, CI; separate contemporaneous vs lead/lag (does sentiment at t predict return t→t+h?) |
| Signal scoring | Hand-tuned integer rules summing to a score; BUY≥4, SELL≤−4 | Weights and cutoffs never fit to or tested against outcomes; the correlation term double-counts sentiment & price which are already terms | Fit weights on a training set (logistic / gradient-boosted); regularise; test out-of-sample; drop collinear terms |
| Confidence | `45 + |score|*7 + …` clamped 45–92 | Not a probability; not calibrated (A5) | Predicted probability from the fitted model + reliability diagram + Brier score; or qualitative only |
| Time windows | 5m / 1h / 24h; `24h` capped at 240 in mock | 5m of news = ~0–2 headlines; statistically empty. Mock/live window mismatch (B12) | Enforce a minimum headline count before emitting a signal; consistent windowing |
| Headline weighting | none (equal) | Front-page Reuters == unknown blog | Source tier weights; headline vs body; primary-source boost |
| Duplicate handling | exact-text unique index | near-dups pass (B7) | hash + near-dup clustering |
| Stale news | none — old `publishedAt` still counts, `updatedAt` faked | stale headlines inflate/deflate the current read | drop articles older than the window; show true `as_of` |
| Timestamp alignment | sentiment bucketed to UTC minute; price = synthetic timestamps | not actually aligned to real market time; no exchange calendar | align both to the same clock; use exchange sessions for stocks |
| Market hours / holidays | ignored | AAPL "price move" at 3am is fabricated movement on a closed market | exchange calendar; last-close semantics; 24/7 only for crypto |
| Crypto vs stock | same pipeline, different `mockVolatility` constant | stocks have **no** real price source at all | separate providers + calendars |
| Causality | "Positive correlation detected" wording | co-movement is presented as relationship / near-prediction | never imply causation or prediction without an out-of-sample forward-return test |
| Sample size | not checked anywhere | signal emitted on n=1 headline | hard minimum n; widen window automatically until n≥k |
| Noise / FP / FN | not measured | unknown error rate | precision/recall per class on held-out data; confusion matrix |

### 3.2 Where the code creates a fake impression of predictive power

1. **"Positive correlation detected"** from `sign(Δa)==sign(Δb)` — the word "correlation" plus a decisive verdict implies a measured statistical relationship. It's two endpoints. (A4)
2. **"Confidence: 77%"** — implies a calibrated probability of being right. It's `45 + score*7`. (A5)
3. **`updatedAt: new Date()`** on mock data — implies freshly-computed live analysis.
4. **The signal's "correlation" term** (`signalService.js:55-58`) adds ±2 when sentiment and price agree — under mock data both are deterministic, so this term is a fixed bias per asset masquerading as market confirmation.
5. **`summaryService`** prose ("reinforcing bullish momentum") — narrative certainty on top of a 2-point comparison.
6. **"Sentiment Momentum" chart** titled as if it leads price; nothing establishes lead/lag.

**"sentiment and price moved the same way over the last hour"** (what the code can *sometimes* show, with real data) ≠ **"sentiment predicted the price move"** (what the UI implies). The gap between those two statements is the entire quant-credibility problem.

### 3.3 What would make the signal engine defensible

- A labelled historical dataset: `(headline, timestamp, asset)` → aggregated features at `t` → **forward return** `r(t → t+h)` for several `h`.
- Features computed using **only information available at `t`** (no future headlines, no revised prices, no full-trend-line when only its prefix was known).
- Chronological train / validation / test split; walk-forward retraining; touch the test set **once**.
- A benchmark set the strategy must beat *out-of-sample, after costs*: buy-and-hold, random signal at equal turnover, sentiment-only, price-momentum-only.
- Reported: Sharpe, Sortino, max drawdown, Calmar, CAGR, hit rate, profit factor, turnover, exposure; and for the classifier: precision/recall/F1 per class, ROC-AUC, **calibration curve + Brier score**.
- Regime breakdown (bull/bear/high-vol/low-vol/earnings-season).
- Explicit bias checks (§17).
- Until all of that exists: the UI says **"illustrative"**, not "signal", and shows no confidence %.

---

## 4. AI / ML (sentiment) evaluation

### 4.1 Is VADER sufficient for financial-news sentiment? No — but don't delete it; demote it to fallback.

VADER is a rule/lexicon model tuned on **social-media microblog** text. Financial-news failure modes:
- Finance vocabulary scores ~0 or wrong: "beat", "miss", "guidance cut", "downgrade", "SEC probe", "recall", "dilution", "short seller", "writedown", "profit warning", "bankruptcy protection", "activist stake".
- Numbers carry the meaning and VADER ignores them: "profit falls 40%", "revenue up 2% vs 8% expected".
- No target attribution: "Nvidia soars as Intel stumbles" → one blended score.
- Headline-only here (`mapArticle` drops `description`); headlines are terse and ironic.
- Negation scope and conditional framing ("not as bad as feared") mishandled.

### 4.2 Options compared (for *this* project)

| Approach | Accuracy (fin-news) | Latency/item | Cost | Infra | Explainability | Real-time fit | Notes |
|---|---|---|---|---|---|---|---|
| **VADER** (current) | Low–moderate | <1 ms | $0 | none (npm) | High (lexicon) | Excellent | Great *fallback*. Deterministic. |
| **FinBERT** (ProsusAI / yiyanghkust finbert-tone) | Good | 50–200 ms CPU, batchable | $0 self-host / ~$ HF Inference | ~400 MB RAM Python/ONNX service, or HF endpoint | Moderate (logits/attention) | Good with batching + cache | Best accuracy-per-dollar. Runs on a small paid instance or ONNX in-process. |
| **LLM** (Claude Haiku / GPT-4o-mini, structured output) | Best; also does relevance + entities + event type + impact in one call | 0.3–2 s | ~$0.0001–0.001/headline | API key, network, rate-limit, retry, cache, fallback | High (can return rationale) | Only with heavy caching + async batch | Non-deterministic unless temp 0 + cached. Cost bounded by dedup+cache. |
| **Hybrid (recommended)** | Best effective | mixed | low | moderate | High | Good | relevance/dedup filter → FinBERT score → LLM only for top-N ambiguous/high-impact + event classification; cache every headline by hash so it's scored once ever. VADER if all else down. |

### 4.3 Recommendation for SentiTrade

Given it's a portfolio/hackathon project that wants quant credibility:

1. **Cache-first sentiment store**: `sentimentCache` keyed by `sha1(normalizedTitle)` → `{score, label, relevance, entities[], event_type, impact, model, model_version, scored_at}`. Every headline is analysed **once, ever**.
2. **Primary model**: FinBERT (self-hosted ONNX microservice or HF Inference API) *or* an LLM batch classifier if you're already using an LLM elsewhere. Store `model`/`model_version` on each record for reproducibility.
3. **Fallback**: VADER, flagged as such in the payload.
4. **Add relevance scoring** (does the article actually discuss this asset's company/asset) and **drop below a threshold** before aggregation — this alone will improve the signal more than swapping the model.
5. **Entity-aware**: attribute sentiment to the target ticker, not the whole headline.
6. Keep it explainable: show which headlines drove the score and their individual scores.

Do **not**: fine-tune your own transformer, run a 7B+ LLM locally, or build a labelling pipeline from scratch for v1.

---

## 5. Data pipeline audit

### 5.1 News

| Concern | Current | Risk | Fix |
|---|---|---|---|
| Provider | NewsAPI `/v2/everything`, free plan | 100 req/day, ToS forbids production, articles delayed, no SLA | Provider abstraction: NewsAPI **or** GNews / Marketaux / Finnhub-news / Tiingo / Alpaca-news; per-provider limiter + backoff + circuit breaker |
| Rate limits | none — `refresh` per request + per 30s socket tick | quota gone in <1h, then silent mock | Scheduled pull (cron), cache, never fetch on read |
| Query quality | `q="bitcoin OR BTC crypto"` boolean string | returns spam, press releases, listicles, unrelated | Curated queries + domain allowlist + relevance model |
| Dedup | exact-text unique index | near-dups pass | hash + near-dup clustering |
| Timestamps | trust `publishedAt`, else `now` | `publishedAt` is often crawl time; `now` fallback corrupts the trend | validate/clamp; drop if missing or absurd |
| Missing fields | `title || description || ""` then VADER("") | empty-string headlines scored as neutral and stored | require non-empty title; skip otherwise |
| Language | `language=en` param only | non-English slips through | post-filter with a language detector |
| Source weighting | none | blog == Reuters | source tier table |
| Failure handling | fall to mock, `console.warn` | invisible degradation | metric `news_fallback_total`, alert if >0 in prod |
| Caching | none | repeated identical pulls | cache raw responses keyed by (asset, hour) |
| Retry | none | one blip → mock for that call | `axios-retry` (exp backoff, 2–3 tries) + `opossum` breaker |

### 5.2 Market data

| Concern | Current | Fix |
|---|---|---|
| Source | CoinGecko crypto (opt-in, **off in prod**); stocks: **none, ever** | Binance klines (crypto, free, WS+REST); Alpaca IEX / Finnhub / Tiingo / Twelve Data (stocks) |
| Live reliability | n/a (mock) | provider abstraction + breaker + cache; WS for crypto |
| Historical | 1 day max, `days` ternary is dead code | dedicated historical loader for backtest (Binance klines back years; Tiingo/Stooq daily for stocks) |
| Timestamp sync | synthetic timestamps; not aligned to sentiment buckets | align both to the same UTC grid; resample |
| Market hours | ignored → fabricated overnight moves for stocks | exchange calendar; last-close semantics; crypto 24/7 |
| Holidays | ignored | exchange calendar library |
| Timezone | mixed; mock uses `now` | store UTC everywhere; convert only at render |
| Fallback | mock series presented as real (A1) | in prod: `price_source: "unavailable"` + empty state, never synthetic |

### 5.3 Where mock data masquerades as live (the important one)

- `priceService`: **always** mock for stocks; mock for crypto unless a non-default flag is set → prod is 100% synthetic prices.
- `newsService.fetchAndStoreNews`: mock on missing key / error / empty / quota.
- `newsService.getSentimentTrend`: mock when Mongo down **or when the query window has no rows** (fresh asset, quiet period).
- `getLatestSentiment`: mock when refresh fails **and** DB empty.
- All of the above stamped `updatedAt: now`, shown under a green "Live socket connected" badge, next to a real TradingView chart.

**Mandatory fix:** a single `data_source` enum (`live | cached | delayed | simulated | unavailable`) on every field/panel, surfaced in the UI, and **`simulated` disabled entirely in `NODE_ENV=production`** (return `unavailable` instead).

---

## 6. Database architecture

**Is MongoDB the right fit?** For this workload — append-heavy, document-shaped news records, time-bucketed aggregation — **yes, keep it**. You'd only outgrow it if you move to tick-level price history + multi-year intraday backtests, at which point a columnar/time-series store (ClickHouse / TimescaleDB) or Parquet+DuckDB for research makes sense. Not now.

Fixes:
- **Indexes**: add compound `{ asset: 1, timestamp: -1 }` (matches every read's filter+sort); the current standalone `asset` and `timestamp` indexes are less efficient for the combined query.
- **TTL**: `{ timestamp: 1 }, { expireAfterSeconds: 60*60*24*90 }` — bounded growth.
- **Dedup**: replace the `{text:1, asset:1}` unique index with `{ dedupeKey: 1 }` unique where `dedupeKey = sha1(normalizedTitle)`. Indexing long strings is fragile (and hits the 1024-byte index-key limit for very long headlines on some configs).
- **Writes**: `bulkWrite` upserts instead of `Promise.all(findOneAndUpdate)`.
- **Aggregation**: materialise a `SentimentRollup` collection (per-5-min bucket per asset: avg, count, pos/neg counts) updated by the ingestion job; the trend endpoint reads rollups directly instead of scanning + `$group` on every request. Or use a native **time-series collection** (Mongo 5.0+) for the raw headlines.
- **Connection**: set `maxPoolSize`, `serverSelectionTimeoutMS: 5000`, `retryWrites: true`; subscribe to `disconnected`/`reconnected` events; decide fail-fast vs degrade (see B9).
- **Research store**: dump historical news+prices to `research/*.parquet` for the backtest — don't run backtests against the live Mongo.

---

## 7. Backend architecture

**Acceptable now:** the routes → controllers → services layering; small single-purpose modules; `helmet` + `compression` + `express-rate-limit` + `express.json` limit; `trust proxy` for Render; graceful-shutdown *intent*; mock-mode for offline dev.

**Needs to change:**

| Gap | Fix |
|---|---|
| Ingestion in the request path | `node-cron` worker; reads only read |
| No config module | `config/index.js` that parses + validates all env (`zod`) once at boot; fail fast on missing prod vars |
| No request validation | `zod` schemas per route + a `validate()` middleware |
| Repetitive try/catch in every controller | `asyncHandler` wrapper |
| No retries/timeouts/breakers on providers | `axios-retry` + `opossum`, per-provider |
| No cache abstraction | `lru-cache` behind a `cache.get/set` interface (swap to Redis later) |
| No structured logging | `pino` + `pino-http` + redaction serializers; request IDs |
| Fake health check | `/api/health` (liveness) + `/api/ready` (deep) |
| Incomplete shutdown | close `io` + `mongoose` + forced-exit timeout |
| No API versioning | mount under `/api/v1` |
| Auth | not needed for public read-only data; add per-IP limits + optionally Cloudflare Turnstile if abused; **do** authenticate any future write/user endpoints |
| Secrets | already env-based (good); add boot-time validation + never log them |

Don't add: a message queue, microservices, GraphQL, a DI framework, Kafka. A single well-structured Express service is correct here.

---

## 8. Real-time architecture

**Current:** per-connection `setInterval(30s)`, each doing full recompute; `emitSnapshot` also on connect and on `asset:change`; polling transport enabled; no auth; no event validation; no Redis adapter.

**Is 30s appropriate?** For news sentiment — **yes, even 60s is fine**; news doesn't move sub-minute, and a manual refresh covers impatience. Price ticks that *do* move fast are already handled by the TradingView iframe, not your socket.

**Target design (incremental, no new infra):**

```
Scheduler (1 timer)                          Clients
  every 30–60s, for each ACTIVE (asset,range) room:
    compute snapshot once  ──► cache ──► io.to("BTC:1h").emit("snapshot", …)

on connection:
  socket.join(`${asset}:${range}`)  ──►  emit cached snapshot immediately
on 'asset:change':
  validate payload (zod) ; leave old room ; join new room ; emit cached (or compute if cold)
on disconnect:
  leave rooms ; if room now empty, scheduler stops computing it
```

This turns *N clients × per-socket timer × full recompute* into *1 timer × M active (asset,range) combos × 1 recompute, broadcast*.

**Also:** validate every inbound event; cap connections per IP; drop the `polling` transport in production (Render supports WS upgrades); add `pingTimeout`/`pingInterval`; only add the **Redis adapter** when you run `numInstances > 1` (not before — it's premature otherwise).

---

## 9. Frontend UX / UI

**Good:** cohesive dark fintech aesthetic, sensible layout (chart left, signal/news right, trend/metrics below), skeletons in `NewsFeed`, connection indicator, responsive grid, `Intl.DateTimeFormat` for times.

**Gaps:**

| Area | Issue | Fix |
|---|---|---|
| Freshness | no "as of" / data-age anywhere; `updatedAt` always now | per-panel timestamp + relative age |
| Simulated data | no indicator (A3) | badge per panel; global banner |
| Disclaimer | not rendered (A6) | persistent banner + methodology link |
| Loading states | only NewsFeed + gauge; chart/correlation/metrics pop in | skeletons everywhere; per-panel loading |
| Empty states | none (empty trend → blank chart) | "no headlines in this window" etc. |
| Error states | one global red bar; panels don't show their own failure | per-panel error + retry |
| Reconnect | "Reconnecting" flashes on first paint before first connect | tri-state: connecting / live / reconnecting |
| Stale-while-reconnected | socket update accepted with wrong `range` (B15) | filter on asset+range |
| Accessibility | gauge SVG no `role`/`aria`; signal encoded by colour only; dropdown not keyboard-navigable (no arrow keys, Esc, `role=listbox`); no visible focus ring on custom controls; no `prefers-reduced-motion` | jest-axe; add ARIA; icons+text not colour alone; keyboard handlers; reduced-motion |
| Number formatting | raw `${number}%`, no thousands separators on price | `Intl.NumberFormat` |
| Component arch | `Dashboard` holds all state + both data channels (B4); no ErrorBoundary | extract a `useDashboardData` hook; single live channel; ErrorBoundary |
| Trust / transparency | signal shown with no "why" beyond 4 canned reason strings | "Explain this signal" drawer: show the score components and the headlines that moved it |
| Chart | single-axis sentiment only | dual-axis sentiment vs price overlay; the actual product thesis |
| Mobile | TradingView iframe fixed 560px; dropdown `w-56` can overflow small screens | responsive heights; constrain dropdown |

To feel like a real fintech product: **freshness + honesty indicators**, a **methodology page**, **explainable signals**, **price/sentiment overlay**, **accessible components**, and consistent sign/colour/icon semantics.

---

## 10. Security audit

| # | Finding | Where | Fix |
|---|---|---|---|
| S1 | 11–12 vulnerable deps, 6–8 high (`ws`, `socket.io-parser` DoS/mem-disclosure) on a **public unauthenticated** socket | both `package.json` | `npm audit fix`; bump socket.io; Dependabot/Renovate; CI `audit --audit-level=high` |
| S2 | Secret leak into logs via raw axios error (`apiKey` in `config.url`) | `app.js:55`, providers | structured logger + redaction; never log error objects |
| S3 | Weak DB creds (`sentiTrade:sentiTrade`) on disk; README says allowlist `0.0.0.0/0`; live NewsAPI key in `.env` | `backend/.env`, `README.md:553` | rotate both; strong password; least-privilege user; Atlas IP allowlist → Render egress; `gitleaks` in CI |
| S4 | No input validation; `limit` → `NaN`; arbitrary `range` | controllers | `zod` on all query params; 400 on bad input |
| S5 | Socket.io: no auth, no per-IP connection cap, no inbound-event validation, polling enabled | `socketService.js` | validate events; cap connections; WS-only in prod; consider a lightweight token |
| S6 | No CSP/HSTS on API; **no security headers at all on the frontend host** | `app.js`, `vercel.json` | helmet CSP+HSTS; frontend `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |
| S7 | CORS dev branch allows any RFC-1918 host on `:5173` | `config/cors.js:20-43` | fine **iff** `NODE_ENV=production` is reliably set (render.yaml does) — add a boot assertion |
| S8 | `credentials: true` on CORS with no cookies/auth used | `config/cors.js:54` | drop it (reduces surface) |
| S9 | DB connection failure swallowed → silent degraded mode | `config/db.js` | fail fast in prod or alarm loudly |
| S10 | Mongoose query args from user input (mitigated by asset whitelist, not by design) | `newsService` | keep the whitelist **and** validate; never pass raw `req.query` objects into queries |
| S11 | No rate limiting on the Socket.io path (only `/api`) | `app.js:27` | connection + event-rate limits in `socketService` |
| S12 | Free-tier Atlas + `0.0.0.0/0` + guessable creds = effectively public DB if cluster is real | deploy | see S3 |
| S13 | No secret scanning / no `.env` in `.gitignore` audit trail note (it *is* ignored — good; keep it that way) | — | `gitleaks` pre-commit + CI |

**Not found (good):** no secrets committed to git history (only 2 commits, `.env` ignored); `VITE_` vars are URLs only (safe to expose); JSON body size capped at 1 MB; `trust proxy` set.

---

## 11. Testing audit

**Current maturity: 0.** No runner, no tests, no CI, no lint, no coverage.

### Recommended pyramid

**Unit (~70%) — Vitest**
- `sentimentService`: label boundaries (±0.05), averaging, empty input, non-string input.
- `signalService`: every score→signal boundary (3/4, −3/−4), confidence clamp (45/92), conflict penalty, reason selection, `reasons.slice(0,4)`.
- `correlationService`: aligned / opposed / sideways; empty trend; threshold edges; missing price.
- `mockDataService`: output shape, length caps, determinism per seed.
- `assetService.normalizeAsset`: known / unknown / lowercase / whitespace / non-string.
- `config/cors.isOriginAllowed`: prod exact-match, prod reject, dev private-host regex (10./192.168/172.16–31), non-5173 port, bad URL.
- `newsService.toMinutes`, `priceService.getPriceChange` math (zero first price, single point).

**Integration (~20%) — supertest + `mongodb-memory-server` + `nock`**
- Each route: 200 shape (contract-validate with zod), 404 handler, error handler, CORS block → 403, rate-limit → 429.
- NewsAPI mocked: success → persisted; 429 → mock fallback + `data_source` flag; timeout → fallback.
- CoinGecko mocked similarly.
- Fresh-DB path: empty window → deterministic behaviour (not silent mock in "prod" mode).
- Dedup: same headline twice → one row (bulkWrite).
- Socket: `socket.io-client` against an ephemeral server — connect → receives snapshot; `asset:change` → new snapshot for new room; disconnect → interval cleared (no leak).

**Contract**
- Shared `zod` schemas validate API responses in tests so frontend and backend can't drift.

**Frontend (~10%) — React Testing Library + jest-axe**
- `Dashboard` in each state: loading / error / empty / populated.
- `SentimentGauge`, `MarketMetrics`, `CorrelationBox` render correct colour/label per signal.
- `AssetSelector`: open/close, select, outside-click, **keyboard nav + axe**.

**E2E (~few) — Playwright**
- Load → chart visible → switch asset → switch range → signal + metrics update → kill network → "Reconnecting" → restore → "Live".

**Quant / eval (separate suite, not merge-blocking)**
- Golden-file snapshot of `generateTradeSignal` over a fixed feature dataset → catches unintended logic drift.
- The backtest harness itself (§17), run on a schedule, output a tearsheet artifact.

**Load — k6 / autocannon**
- `/api/sentiment` sustained; verify the cache holds NewsAPI calls flat regardless of RPS.
- Socket fan-out: 500 connections, confirm 1 recompute per interval, not 500.

CI gate: lint + typecheck (add `// @ts-check` or migrate to TS) + unit + integration + build + `npm audit --audit-level=high`; coverage ≥ 70% lines.

---

## 12. DevOps / deployment audit

| Area | Current | Needed |
|---|---|---|
| CI | none | GitHub Actions: install → lint → test → build (both apps) → audit → coverage upload; block merge on red |
| CD | Render auto-deploy on push (implied) | keep, but require CI green; add a `staging` env / PR previews |
| Build | `npm ci` / `npm run build` | pin Node (`NODE_VERSION` in render.yaml, `.nvmrc`, tighten `engines` to `20.x`) |
| Env vars | `render.yaml` `sync:false` for secrets (good) | add boot-time validation; document each; add `NODE_ENV` assertion |
| Frontend deploy | Vercel or Render static; SPA rewrite present | add security headers; validate `VITE_*` at build; the `render.yaml` static block and Vercel both exist — pick one to avoid drift |
| DB | Atlas free | strong creds, IP allowlist, backups on, alerts on |
| Health checks | fake `/api/health` | real `/api/ready`; point Render at it |
| Logging | `console.*` → Render logs | `pino` JSON → Render logs → optional Better Stack / Logtail free tier |
| Monitoring | none | UptimeRobot on `/api/ready`; Sentry (both apps); optional `prom-client` + Grafana Cloud free |
| Restart behaviour | Render restarts on crash; per-socket timers lost on free-tier sleep | document; or upgrade off free; scheduler recovers on boot |
| Graceful shutdown | partial (B10) | complete it |
| Rollback | Render keeps deploys | document one-click rollback; tag releases; keep migrations backward-compatible |
| Dependency pinning | `^` ranges, lockfiles committed (good) | Renovate/Dependabot; `npm ci` everywhere (done) |
| Prod vs dev config | `NODE_ENV` switches CORS | centralise all env-driven behaviour in `config/`; log the effective config (redacted) at boot |
| Secret scanning | none | `gitleaks` in CI + pre-commit |
| Container | none | optional `Dockerfile` for local parity |

---

## 13. Observability — recommended (lean) stack

| Need | Tool (free/cheap) | What to capture |
|---|---|---|
| Structured logs | `pino` + `pino-http` → Render stdout → Better Stack / Logtail free | request id, route, status, latency, `data_source`, provider outcomes |
| Error tracking | Sentry free (backend + frontend) | exceptions, unhandled rejections, socket errors, frontend render errors |
| Uptime | UptimeRobot / Better Uptime | `/api/ready` every 1–5 min |
| Metrics | `prom-client` → Grafana Cloud free (optional) | `http_request_duration`, `news_fetch_total{outcome}`, `news_fallback_total`, `price_fallback_total`, `signal_emitted_total{signal}`, `socket_connections`, `snapshot_compute_duration`, `mongo_up` |
| Stale-data detection | derived metric + alert | `mock_served_in_production_total` must be **0**; alert if >0 |
| Signal sanity | dashboard | distribution of BUY/SELL/HOLD over time (should not be 95% one class) |
| Alerting | Better Stack / Grafana / e-mail | ready-check fail, error-rate spike, Mongo disconnect, NewsAPI 4xx/quota, `mock_served_in_production > 0` |

Don't: ELK, Datadog, self-hosted Prometheus+Grafana+Loki, OpenTelemetry collector fleet. Overkill for one service.

---

## 14. Product-level missing features — with judgement

| Feature | Verdict | Rationale |
|---|---|---|
| Honest data-source / freshness indicators | **Must** | Non-negotiable for a signal product |
| Visible disclaimer + methodology page | **Must** | §15 |
| Price vs sentiment overlay chart | **Must** | It's literally the product thesis; currently price and sentiment are never shown on the same axes |
| "Explain this signal" (show inputs + driving headlines) | **Should** | Trust; also cheap given the data already exists |
| Historical signal log + outcome tracking | **Should** | Enables the calibration story; strong portfolio signal |
| Relevance / source-credibility surfacing | **Should** | Improves the underlying signal and its explainability |
| Watchlist / multi-asset compare | **Should** | Natural, low-risk, high perceived value |
| Configurable thresholds | **Later** | Only meaningful once thresholds are validated |
| Alert delivery (email / web-push) | **Later** | Ops burden; do after accounts exist |
| User accounts + saved preferences | **Later** | Needed for watchlists/alerts to persist; adds auth surface |
| Event / catalyst detection | **Later** | High value, needs the LLM/NLP layer first |
| Technical-indicator overlay | **Later** | TradingView already provides this; don't reinvent |
| Portfolio / risk / position sizing | **Don't (for now)** | Turns "educational" into "advice"; regulatory exposure |
| Backtest UI / strategy builder | **Later** | Build the backtest *engine* first (offline), expose later |
| Social / community / copy-trading | **Don't** | Scope creep, moderation burden, regulatory |
| Multi-language | **Don't (now)** | No user demand signal |
| Mobile app | **Don't (now)** | Responsive web is enough |

---

## 15. Regulatory / financial-product concerns

The product outputs **BUY / SELL / HOLD** + a **confidence %** + **"Momentum alert"** + **"Positive correlation detected"**, is named **SentiTrade**, and headlines itself **"Real-time market intelligence"**. The only disclaimer is a string in the API that the UI never renders.

Risks:
- **Implied investment advice / recommendation.** "BUY" with a confidence number is a recommendation in substance regardless of a footnote.
- **Implied predictive power / performance claim.** "confidence", "correlation detected", "momentum" all imply the system knows something about future returns. No backtest supports this.
- **README overclaims.** "production-grade", "converts sentiment … into BUY, SELL, or HOLD", correlation language — in a portfolio/interview context this reads as a claim you can't defend when questioned.

Changes needed:
1. **Rename the output**: "Sentiment bias" / "News tone signal" / "Illustrative signal" — not "Trade Signal". Consider whether "SentiTrade" should be "SentiScope" / "SentiPulse".
2. **Remove the confidence %** until it's calibrated; replace with "weak/moderate/strong alignment".
3. **Kill predictive verbs**: no "predicts", "forecast", "correlation detected", "will". Use "sentiment and price *co-moved*", "news tone *is*".
4. **Persistent, visible disclaimer** on every screen: *"Educational tool. Not investment advice. No recommendation to buy or sell any security or asset. Signals are illustrative and not backtested."*
5. **Methodology page**: exactly how each number is computed, data sources, known limitations, and the fact that (currently) some data is simulated.
6. **If you ever add a backtest**: show the full tearsheet including costs and drawdown, state the sample period, and never annualise a short or cherry-picked window.
7. Add a `LICENSE` and a "this is a personal project" note.

None of this is legal advice — but for a public tool that says "BUY", these are the minimum framing changes to not mislead.

---

## 16. A stronger signal architecture (what to actually include)

**Include (v1, defensible):**

| Input | Why | Weight source |
|---|---|---|
| News sentiment (FinBERT/LLM), relevance-filtered, source-weighted, time-decayed | Core thesis; the honest version of what exists | fitted, not hand-set |
| Sentiment momentum = EWMA(fast) − EWMA(slow) of the aggregate | Captures *change* in tone, which is where any edge would live | fitted |
| Headline volume / volume spike (z-score vs trailing mean) | A surge in coverage is itself information | fitted |
| Price momentum (log return over window) + realised volatility | Context; also the thing you're predicting/comparing against | fitted |
| Rolling sentiment↔return correlation (r, n) as a *context feature*, not a vote | Tells you whether tone is currently tracking price at all | feature |

**Consider later:** event-type classification (earnings/M&A/regulatory/macro), market-impact score, market regime (trend/chop, vol bucket), cross-asset/sector sentiment.

**Exclude:** technical indicators (TradingView already shows them; low marginal info for a *sentiment* product), volume/breadth data you don't have a source for, anything requiring paid intraday equity data before it's justified.

**How to combine:**
- Start with **transparent logistic regression** (or a shallow gradient-boosted model) predicting `P(forward return over h > threshold)`; features standardised; L2 regularisation.
- Output = calibrated probability → map to LONG/FLAT/SHORT bias with a **neutral band** (don't trade weak signals).
- **Confidence = the calibrated probability**, shown only after a reliability diagram proves it's honest.
- Keep the current rule engine as an **explainable baseline** to compare against — if the ML model can't beat the rules out-of-sample, ship the rules and say so.

**Avoiding overfitting:**
- Few features (≤ ~8), regularised, chronological CV, walk-forward.
- Tune hyperparameters on **validation only**; the test set is touched once.
- Report performance with confidence intervals / across multiple random seeds and multiple assets.
- Prefer a model that's slightly worse but stable across regimes over one that's great on the test slice.

**Validation:** §17.

---

## 17. Backtesting & evaluation — what's missing (everything)

There is currently **no** historical data, **no** labels, **no** forward-return notion, **no** evaluation. The strategy's efficacy is **unknown**, and nothing in the repo or README may claim otherwise.

**Build:**

1. **Historical news**: free realistic path = **GDELT** (global, 2015+, free) and/or Tiingo news; NewsAPI free can't backfill (1-month, delayed). Or start logging now and revisit in months.
2. **Historical prices**: **Binance klines** (crypto, minute bars, years, free); Tiingo / Stooq / Alpaca (equities daily); Polygon (paid) only if you need intraday equities.
3. **Alignment**: for each signal time `t`, features use only data with `timestamp ≤ t` (and account for the lag between article publish and availability); label = forward return `r(t → t+h)` for `h ∈ {1h, 4h, 1d}`. Trade execution assumed at the **next bar's open**, not `t`'s close.
4. **Splits**: chronological train / validation / test (e.g. `≤2022 / 2023 / ≥2024`); **walk-forward** with expanding window; test set used once.
5. **Costs**: commission + half-spread + slippage (crypto ~5–10 bps round-trip; equities ~1–5 bps + spread); latency (signal available minutes after publish); borrow cost for shorts.
6. **Benchmarks it must beat, net, out-of-sample**: buy-and-hold; random signal at matched turnover; sentiment-only; price-momentum-only.
7. **Metrics**: CAGR, Sharpe, Sortino, max drawdown, Calmar, hit rate, profit factor, turnover, exposure, tail stats. Classifier: precision/recall/F1 per class, confusion matrix, ROC-AUC, **calibration curve + Brier score**.
8. **Regime slices**: bull / bear / high-vol / low-vol / earnings vs non-earnings.

**Biases to actively hunt and document:**
- **Look-ahead**: using the full trend line when only its prefix was known; revised prices; `publishedAt` earlier than actual availability; using `t+h` data in features.
- **Survivorship**: delisted equities, dead tokens missing from the universe.
- **Data leakage**: any learned component (dedup, relevance, sentiment calibration) fit on data overlapping the test period; scaler/threshold fit on all data.
- **Selection bias**: BTC/ETH/AAPL are liquid, news-heavy, and trending — report on a randomised universe too.
- **Multiple testing / p-hacking**: every threshold you tweak while looking at test results is overfitting; tune on validation, touch test once, report how many configs you tried.

**Deliverable**: a `research/` notebook + a reproducible, seeded `backtest` script producing a one-page tearsheet. **A portfolio project that shows a walk-forward backtest with costs and a calibration curve — even one that concludes "no exploitable edge found" — is dramatically stronger than one that shows a confident "BUY 77%".** Rigor is the differentiator.

---

## 18. Architecture — current vs target

### Current

```
Browser ──REST──► Express ──► services (news/sentiment/price/correlation/signal)
   │                 │            ├─ NewsAPI (per request, quota-blind)
   │                 │            ├─ CoinGecko (disabled in prod)
   │                 │            ├─ VADER (in-proc)
   │                 │            └─ Mongo (Atlas) — or silent mock
   └──WebSocket──► Socket.io ──► per-connection 30s setInterval ──► same services
```

### Target (incremental — same core stack)

```mermaid
flowchart TB
  subgraph Client
    UI[React SPA<br/>freshness + simulated badges + methodology]
    TV[TradingView iframe]
  end

  subgraph Edge
    CDN[Vercel/Render static + security headers]
  end

  subgraph Backend[Express service — single instance]
    REST[REST /api/v1<br/>zod validation + asyncHandler]
    WS[Socket.io<br/>rooms per asset:range, event validation]
    SCHED[Scheduler<br/>compute snapshot per active room, 30–60s]
    CACHE[(in-proc LRU cache<br/>→ Redis when multi-instance)]
    subgraph Providers[Provider adapters — retry + circuit breaker]
      NEWSAD[News: NewsAPI/GNews/Marketaux]
      PXAD[Price: Binance / Alpaca / Tiingo]
    end
    SENT[Sentiment: FinBERT/LLM svc + cache<br/>VADER fallback]
    SIG[Signal engine<br/>rule baseline + calibrated model]
  end

  subgraph Jobs[node-cron workers]
    INGEST[News ingestion → dedupe → sentiment → Mongo]
    ROLLUP[Rollup aggregation → SentimentRollup]
  end

  subgraph Data
    MONGO[(MongoDB Atlas<br/>TS collection + rollups + TTL)]
    RESEARCH[(research/*.parquet<br/>backtest only)]
  end

  subgraph Obs[Observability]
    LOGS[pino → Better Stack]
    ERR[Sentry]
    UP[UptimeRobot /api/ready]
    MET[prom-client → Grafana Cloud]
  end

  UI --> CDN --> REST
  UI <--> WS
  UI --> TV
  REST --> CACHE --> SCHED
  WS --> SCHED
  SCHED --> SENT & SIG & MONGO
  Jobs --> Providers & SENT & MONGO
  Providers -.-> Obs
  Backend --> Obs
  RESEARCH -.offline.-> SIG
```

**Keep:** React/Vite/Tailwind, Chart.js (or swap price panel to `lightweight-charts`), Express, Socket.io, Mongo Atlas, Render/Vercel.
**Add:** cron workers, provider adapters (retry+breaker), sentiment service + cache, scheduler+broadcast, LRU cache, observability, backtest research store.
**Don't add:** Redis (until >1 instance), Kafka, k8s, microservices, GraphQL.

---

## 19. "Missing Things" master checklist

| Area | Missing / weak item | Severity | Why needed | Recommended solution | Effort |
|---|---|---|---|---|---|
| Data integrity | Synthetic prices served as live in prod | Critical | Product shows fabricated facts | Real providers; `unavailable` state, never fake | M |
| Data integrity | Silent mock news fallback, faked `updatedAt` | Critical | Same | Scheduled ingest + cache; `data_source` flag; no mock in prod | M |
| UX | No simulated/stale/freshness indicator | Critical | User can't tell working from broken | `data_source`/`as_of` badges + banner | S–M |
| Quant | "Correlation" is 2-point sign match | Critical | Implies unmeasured statistical relationship | Rolling Pearson/Spearman, report r/n/CI, honest labels | M |
| Quant | "Confidence %" is invented | Critical | Users read it as probability | Remove now; calibrate later via backtest | S / L |
| Compliance | Disclaimer never rendered; predictive wording | Critical | Misleads users of a BUY/SELL tool | Persistent disclaimer, methodology page, reword | S |
| Security | 11–12 vulnerable deps (6–8 high) | Critical | Public unauth socket DoS/mem-disclosure | `npm audit fix` + bump + Renovate + CI gate | S |
| Security | Secret leak to logs (apiKey in error url) | Critical | Key exposure in Render logs | Structured logger + redaction | S |
| Security | Weak DB creds + `0.0.0.0/0` guidance | Critical | Effectively public DB | Rotate, least-priv user, IP allowlist | S |
| Reliability | Fake health check | Critical | Degraded instance stays live, no alert | `/api/ready` deep check | S |
| Backtesting | No historical data / labels / evaluation at all | Critical (for the claim) | Can't assert the signal works | GDELT + Binance + walk-forward harness + tearsheet | L |
| Testing | Zero tests / CI / lint | High | Nothing prevents regressions | Vitest+supertest+Playwright+Actions; ≥70% | L |
| Backend | Ingestion in request path; NewsAPI quota unprotected | High | Quota gone in <1h → mock | `node-cron` job + cache | M |
| Realtime | Per-socket timers, no broadcast | High | O(clients) provider load | Scheduler + rooms + `io.to().emit` | M |
| Backend | No input validation | High | `NaN` queries, fragile safety | `zod` per route | S |
| DB | No TTL; unbounded growth | High | Cost + slow aggregation | TTL index + rollup collection | S |
| DB | Full-string dedup key; near-dups pass | High | Skews averages | `sha1(title)` dedupeKey + near-dup pass | M |
| DB | N upserts per fetch | High | Latency, load | `bulkWrite` | S |
| DB | Missing `{asset:1,timestamp:-1}` compound index | High | Slow reads | Add it | S |
| Backend | DB failure swallowed | High | Silent degraded mode | Fail fast / alarm | S |
| Backend | Incomplete graceful shutdown | High | Hung SIGTERM, dropped conns | Close io+mongoose+timeout | S |
| Quant | Trend = minute buckets, endpoint deltas | High | High-variance noise | Wider buckets, min count, EWMA, slope | M |
| Frontend | REST+socket double-write, race | High | Inconsistent state, double fetch | Single live channel | M |
| Frontend | No ErrorBoundary; StrictMode removed | High | White screen; hidden bugs | Add both; fix root cause | S |
| Frontend | Socket update ignores `range` mismatch | High | Wrong-window data shown | Filter asset+range | S |
| Sentiment | VADER only, titles only, no relevance/entity | High | Wrong for finance; off-topic noise | FinBERT/LLM + relevance + entity + cache; VADER fallback | M–L |
| AI infra | No sentiment cache / model versioning | High | Re-scoring, non-reproducible | Hash-keyed cache with `model_version` | S–M |
| Security | No security headers on frontend host | High | Clickjacking, etc. | CSP/XFO/Referrer via vercel.json | S |
| Security | Socket path unauthenticated + unrate-limited | High | Abuse | Conn cap + event validation | S |
| DevOps | No CI/CD pipeline | High | Manual, error-prone | GitHub Actions | M |
| DevOps | Node pin `>=18` (EOL) | Medium | Security/support | Pin 20.x everywhere | S |
| Observability | `console.log` only; no metrics/errors/uptime | Medium–High | Blind in prod | pino+Sentry+UptimeRobot(+prom) | M |
| Observability | No "mock served in prod" alarm | High | Core failure invisible | metric + alert, target 0 | S |
| Market data | No stock price source ever | High | AAPL correlation is pure fiction | Alpaca/Finnhub/Tiingo | M |
| Market data | No market-hours/holiday/timezone handling | High | Fabricated overnight moves | Exchange calendar, last-close semantics | M |
| Backend | No API versioning | Medium | Breaking changes break clients | `/api/v1` | S |
| Backend | No config module / env validation | Medium | Misconfig discovered at runtime | `config/` + zod, fail fast | S |
| Backend | No retry/circuit breaker on providers | Medium–High | One blip → mock | axios-retry + opossum | S–M |
| Frontend | a11y: color-only signals, dropdown not keyboard-navigable, gauge no ARIA | Medium | Excludes users; portfolio red flag | ARIA, keyboard, icons+text, jest-axe | M |
| Frontend | No empty/per-panel error/loading states | Medium | Confusing failures | Add them | M |
| Frontend | No price/sentiment overlay | Medium | It's the product thesis | Dual-axis chart | M |
| Docs | README overclaims ("production-grade", "correlation", "converts into BUY/SELL") | Medium | Credibility when questioned | Rewrite honestly; add METHODOLOGY.md, LICENSE | S |
| Product | No signal history / outcome tracking | Medium | Needed for calibration + trust | Log signals + later outcomes | M |
| DevOps | No secret scanning | Medium | Future `.env` leak | gitleaks CI + pre-commit | S |
| DevOps | Dup deploy config (render.yaml static + vercel.json) | Low | Drift | Pick one | S |
| Misc | CoinGecko `days` dead ternary; no key header | Medium | Broken/È fragile live path | Fix windowing + key + retry | S |
| Misc | Google Fonts `@import` render-blocking | Low | Perf | Preconnect / self-host | S |

---

## 20. Prioritised roadmap

### Phase 0 — Fix critical / stop misleading (days, do first)
| Task | Dep | Impact | Cx |
|---|---|---|---|
| `npm audit fix` + bump socket.io/client; add Renovate | — | Closes 6–8 high vulns | S |
| Rotate NewsAPI key + MongoDB creds; strong DB user; Atlas IP allowlist → Render egress | — | Closes public-DB risk | S |
| Structured logger + redaction; stop logging raw errors | — | Closes secret-leak | S |
| Add `data_source` (`live/cached/delayed/simulated/unavailable`) to every API field; **disable `simulated` when `NODE_ENV=production`** (return `unavailable`) | — | Ends the core dishonesty | M |
| Render simulated/stale/freshness badges + global banner in UI | above | User can trust the screen | M |
| Render a persistent disclaimer; remove "confidence %" (→ weak/moderate/strong); reword predictive language; add METHODOLOGY.md | — | Compliance / honesty | S |
| Relabel "correlation": compute real rolling r + n, or rename to "co-movement (not predictive)" | — | Kills fake-predictive-power | M |
| Real `/api/ready` (Mongo + last-fetch freshness); point Render at it; alarm on mock-in-prod | logger | Detect degradation | S |
| Input validation (`zod`) on all routes | — | Robustness | S |

### Phase 1 — Production foundation (1–3 weeks)
| Task | Dep | Impact | Cx |
|---|---|---|---|
| Move news ingestion to `node-cron`; reads only read; LRU cache | data_source | NewsAPI quota safe, faster | M |
| Provider adapters (news + price) with `axios-retry` + `opossum` | ingest job | Resilience | M |
| Real price providers: Binance (crypto) + Alpaca/Finnhub/Tiingo (stocks); market-hours/calendar/timezone | adapters | Real correlation input | M–L |
| Socket: scheduler + `asset:range` rooms + broadcast + event validation + conn caps; drop polling in prod | — | Scales, secure | M |
| Frontend: single live channel (socket), REST for first paint; ErrorBoundary; restore StrictMode; filter asset+range | — | Consistent state | M |
| DB: compound index, TTL, `dedupeKey` hash + `bulkWrite`, rollup collection, connection opts, fail-fast | — | Perf + bounded growth | M |
| Complete graceful shutdown | — | Clean deploys | S |
| Testing: Vitest unit (sentiment/signal/correlation/cors/asset) + supertest integration + socket + Playwright smoke; GitHub Actions (lint+test+build+audit); ESLint/Prettier; `.nvmrc` + Node 20 | — | Regression safety | L |
| Observability: pino+pino-http, Sentry (both), UptimeRobot; metrics for fetch/fallback/signal-distribution | logger | Visibility | M |
| Frontend security headers; helmet CSP/HSTS; `/api/v1`; config module + env validation; LICENSE; README rewrite | — | Hardening / credibility | M |

### Phase 2 — Data & quant quality (3–6 weeks)
| Task | Dep | Impact | Cx |
|---|---|---|---|
| Sentiment: hash-keyed cache with `model_version`; FinBERT service (ONNX) or LLM batch classifier; VADER fallback | ingest job | Real financial sentiment | M–L |
| Relevance scoring + entity attribution + near-dup clustering; source credibility weights; time-decay aggregation | sentiment cache | Signal-quality lift (biggest single win) | M |
| Trend: wider buckets, min-count, EWMA smoothing, slope-based momentum; consistent windowing mock=live | rollups | Less noise | M |
| Historical data pipeline: GDELT news + Binance/Tiingo prices → `research/*.parquet` | — | Enables backtest | M |
| Backtest harness: alignment, forward returns, walk-forward, costs/slippage, benchmarks, full metrics + calibration + regime slices; bias checklist documented | historical data | Defensibility | L |
| Signal v2: logistic/GBM on ≤8 standardised features, chronological CV, calibrated probability, neutral band; keep rule baseline for comparison; ship whichever wins OOS | backtest | Real (or honestly "no edge") signal | L |
| Golden-file signal snapshot tests; scheduled backtest → tearsheet artifact | backtest | Drift protection | M |
| "Explain this signal" drawer; price/sentiment overlay chart; signal history log | signal v2 | Trust + product thesis | M |

### Phase 3 — Product & UX (2–4 weeks)
| Task | Dep | Impact | Cx |
|---|---|---|---|
| Watchlist / multi-asset compare | — | Perceived value | M |
| Full a11y pass (ARIA, keyboard, icons+text, reduced-motion, jest-axe in CI) | tests | Inclusivity + portfolio quality | M |
| Empty/per-panel error/loading states; number formatting; connection tri-state | — | Polish | M |
| Methodology page (interactive: show the actual math + sources + limitations) | signal v2 | Credibility | M |
| Historical sentiment/signal browsing | signal history | Depth | M |
| Optional: user accounts + saved prefs (only if watchlist/alerts need persistence) | — | Foundation for alerts | M |

### Phase 4 — Scale & advanced (only if needed)
| Task | Trigger | Cx |
|---|---|---|
| Redis: cache + Socket.io adapter | `numInstances > 1` | M |
| Event/catalyst detection + market-impact scoring (LLM) | quant v2 stable | L |
| Market-regime model; cross-asset/sector sentiment | — | L |
| Alert delivery (web-push/email) | accounts exist | M |
| Prom-client + Grafana Cloud dashboards | metrics volume justifies | M |
| Backtest UI / scenario explorer | research engine mature | L |

---

## 21. Must / Should / Later / Don't (anti-overengineering)

**Must have (credible production version):** honest data-source indicators · no silent mock in prod · real price + news providers with fallback states · visible disclaimer + methodology + honest wording · rolling correlation (or honest relabel) · remove fabricated confidence · input validation · structured logging + error tracking + uptime + real readiness check · `npm audit` clean + Renovate · secret rotation + redaction · unit + integration + smoke tests + CI · TTL + indexes + bulkWrite · scheduled ingestion + cache · complete graceful shutdown · Node 20 pin.

**Should have:** FinBERT/LLM sentiment + relevance + entity + cache · socket scheduler/broadcast · backtest harness + tearsheet · signal history · "explain signal" + price/sentiment overlay · a11y pass · frontend security headers · API versioning · Sentry on frontend · Playwright E2E.

**Later (at scale / once justified):** Redis (cache + socket adapter) · event detection · regime model · alert delivery · user accounts · prom-client/Grafana · Dockerfile · rate-limit Redis store.

**Don't need (for this project):** Kafka / RabbitMQ / any message broker · Kubernetes · microservices split · GraphQL · multi-region · custom charting library · real broker/order execution · blockchain anything · self-hosted ELK/Datadog/Prometheus fleet · OpenTelemetry collectors · a feature-store product · LLM fine-tuning · CQRS/event-sourcing · a monorepo build system (Nx/Turbo) for two small apps · SSR/Next.js (the SPA is fine).

---

## 22. Benchmark: where SentiTrade sits

| | Hackathon demo | Polished portfolio project | Serious production app |
|---|---|---|---|
| Data | mock is fine if labelled | **real, with honest fallback states** | SLA providers, redundancy |
| Signal | rule-based, transparent | **rule-based + a walk-forward backtest with costs + calibration curve** (even if it shows no edge) | validated model + drift monitoring + regime awareness |
| Wording | "educational" | disclaimers + methodology page + no predictive verbs | legal review of all claims |
| Tests | none expected | **unit + integration + E2E + CI, ~70% cov** | + load, chaos, contract, coverage gates |
| Observability | none | logs + Sentry + uptime | + metrics, tracing, on-call, SLOs |
| Security | basic | audit-clean deps, headers, secret hygiene, input validation | + pen test, threat model, WAF |
| a11y | not expected | keyboard + ARIA + contrast + axe in CI | WCAG AA audited |
| Docs | README | honest README + METHODOLOGY + ARCHITECTURE + LICENSE | + runbooks, ADRs, API reference |

**SentiTrade today:** a strong-looking hackathon demo with production *scaffolding* but demo-grade *substance*. The visual design and code organisation are above average for the category; the data honesty, quant validity, testing, and observability are not yet at "polished portfolio" level.

**What makes it stand out (in order of impact):**
1. **A walk-forward backtest with transaction costs and a calibration curve**, written up honestly — with the conclusion stated plainly whatever it is. Almost no "AI trading signal" project on GitHub does this. It signals research maturity more than any feature.
2. **Data honesty**: freshness/simulated badges, a methodology page, no silent mock. Reviewers notice when a dashboard tells the truth about its own uncertainty.
3. **Engineering hygiene**: tests + CI + structured logging + error tracking + `npm audit` clean. Table stakes for "senior", frequently missing in portfolio projects.
4. **The actual product thesis executed**: price and sentiment on the *same* chart with lead/lag analysis — currently they're never shown together.
5. Real financial sentiment (FinBERT/LLM + relevance) instead of VADER-on-headlines.

Adding more *assets* or *panels* does not move the needle; the five above do.

---

## 23. Final output

### Executive Verdict
**24 / 100 as a production financial-signal system** (≈70/100 as a hackathon visual demo). Clean code organisation and real deployment scaffolding, undermined by: synthetic data presented as live with no indicator, a "correlation" that is a 2-point sign match, a fabricated "confidence %", an unrendered disclaimer, zero tests/CI, zero observability, known-vulnerable public socket deps, and no backtesting to support any of the claims. The gap is substance, not polish.

### Top 10 Problems
1. Prices are 100% synthetic in the default deployment; stocks have no live source ever (A1).
2. News silently degrades to 6 hardcoded headlines with a faked fresh timestamp (A2).
3. No simulated/stale indicator anywhere — the real TradingView chart launders credibility onto fake numbers (A3).
4. "Correlation" is `sign(Δa)==sign(Δb)` on 2 points — implies a statistical relationship never measured (A4).
5. "Confidence %" is `45 + score*7`, uncalibrated, read by users as a probability (A5).
6. The disclaimer is returned by the API but never shown in the UI (A6).
7. Secret leak vector: raw axios errors log the NewsAPI key into Render logs (A7).
8. Weak DB creds (`sentiTrade:sentiTrade`) + `0.0.0.0/0` guidance = effectively public DB (A8).
9. 11–12 vulnerable deps (6–8 high, `ws`/`socket.io-parser` DoS) on an unauthenticated public socket (A9).
10. Fake health check + swallowed DB failure = degraded instances stay live with no alert (A10, B9).

### Top 10 Improvements
1. Thread `data_source`/`as_of` through every response; badge it; **disable mock in production**.
2. Real price + news provider adapters (Binance, Alpaca/Finnhub/Tiingo, GNews/Marketaux) with retry + circuit breaker + cache.
3. Move ingestion to a `node-cron` job; reads only read; LRU cache — fixes the NewsAPI quota blowout.
4. Build the backtest harness (GDELT + Binance, walk-forward, costs, calibration, benchmarks) and publish an honest tearsheet.
5. Replace VADER with FinBERT/LLM + relevance + entity attribution + a hash-keyed sentiment cache; VADER as fallback.
6. Real rolling correlation (r, n, CI) + honest labels; remove the fabricated confidence % (qualitative until calibrated).
7. Persistent disclaimer + Methodology page + remove predictive wording; rename "Trade Signal".
8. Test suite (Vitest + supertest + socket + Playwright) + GitHub Actions CI + ESLint/Prettier + Node 20 pin.
9. Observability: pino + Sentry + UptimeRobot + metrics, with a hard alert on "mock served in production".
10. Socket scheduler with `asset:range` rooms + broadcast; single live channel on the frontend; ErrorBoundary + StrictMode.

### Hidden Problems
- `updatedAt: new Date()` makes every mock/stale payload look freshly computed.
- The signal's "correlation" term adds a fixed per-asset bias under mock data, masquerading as market confirmation.
- Mock and live code paths use different windowing (`Math.min(minutes,240)` vs 1440) — demo behaviour ≠ prod behaviour.
- `getSentimentTrend` returns mock even with Mongo **up** whenever the query window is empty (fresh asset, quiet hour).
- `limit=abc` → `.limit(NaN)` reaches Mongo.
- Socket updates with a stale `range` are accepted (chart shows 24h while UI says 5m).
- `credentials: true` on CORS with no cookies in use — needless surface.
- CoinGecko `days` ternary is dead code; every range fetches a full day.
- Free Render plan sleeps → per-socket 30s timers silently die; no catch-up on wake.
- Near-duplicate headlines each get counted in the sentiment average (full-string dedup key).
- Only 2 commits in history — no evidence of iterative development for a reviewer to read.

### Missing Features (genuinely needed)
Honest data-source/freshness indicators · visible disclaimer + methodology page · price↔sentiment overlay chart · "explain this signal" · signal history + outcome tracking · relevance/source-credibility surfacing · watchlist/multi-asset compare · real stock price source. (Not needed now: portfolio/risk tooling, alert delivery, accounts, event detection, config UI, mobile app, i18n, social.)

### Quant / AI Weaknesses
2-point "correlation" mislabelled · uncalibrated "confidence" · hand-tuned unvalidated thresholds · no forward-return concept · no backtest, no benchmark, no calibration · VADER wrong for finance vocabulary, titles only, no relevance filter, no entity attribution · minute-bucket trend is high-variance noise · momentum from endpoint difference · 5m window is statistically empty · no minimum sample size · co-movement presented as prediction · look-ahead risk (full trend line used when only prefix was known) · signal double-counts sentiment and price.

### Security Risks
Vulnerable deps (6–8 high) on unauth public socket · secret leak to logs · weak DB creds + open network guidance · live NewsAPI key in plaintext `.env` (rotate) · no input validation · no security headers on the frontend host · socket path unauthenticated + unrate-limited · swallowed DB failure · no secret scanning. (Clean: no secrets in git history, `.env` ignored, body size capped, `trust proxy` set.)

### Testing Gaps
Everything — no runner, no unit, no integration, no socket, no frontend, no E2E, no load, no CI, no lint, no coverage. Target ~70/20/10 (unit/integration/E2E) + a separate quant golden-file + backtest suite; CI gate at ≥70% lines + `npm audit --audit-level=high`.

### DevOps Gaps
No CI/CD · Node pin `>=18` (EOL) · fake health check · no readiness endpoint · `console.log` only · no error tracking · no uptime monitor · incomplete graceful shutdown · no secret scanning · duplicate deploy config (render.yaml static + vercel.json) · free-tier cold-start / sleep issues undocumented · no staging env / PR previews · no rollback runbook.

### Target Architecture
Same core stack (React/Vite/Tailwind, Express, Socket.io, Mongo Atlas, Render/Vercel) + `node-cron` ingestion workers + provider adapters (retry/breaker) + FinBERT/LLM sentiment service with a hash-keyed cache + a scheduler that computes one snapshot per active `asset:range` room and broadcasts + an in-proc LRU cache (Redis only when `numInstances>1`) + Mongo time-series/rollup collections with TTL + an offline `research/*.parquet` store for backtesting + pino/Sentry/UptimeRobot(/prom-client) observability. Diagram in §18. Incremental evolution, no rewrite.

### Production Roadmap
Phase 0 (days): security + honesty — audit fix, rotate secrets, redact logs, `data_source` flags + UI badges, disclaimer + reword, real readiness check, input validation, relabel correlation, remove confidence %.
Phase 1 (1–3 wk): scheduled ingestion + cache, provider adapters, real price sources + market calendar, socket scheduler/rooms, frontend single-channel + ErrorBoundary, DB indexes/TTL/dedupe/bulkWrite/rollups, tests + CI, observability, headers/versioning/config/README.
Phase 2 (3–6 wk): FinBERT/LLM sentiment + relevance + entity + cache, trend smoothing, historical data pipeline, backtest harness + tearsheet, signal v2 (calibrated, walk-forward), explain-signal + overlay + history.
Phase 3 (2–4 wk): watchlist, full a11y, empty/error states, methodology page, historical browsing, optional accounts.
Phase 4 (as needed): Redis, event detection, regime model, alert delivery, Grafana.

### Final Recommended Stack
**Keep:** React 18 + Vite + Tailwind · Chart.js (consider `lightweight-charts` for the price panel) · Express 4 · Socket.io · MongoDB Atlas · Render + Vercel.
**Add:** `zod` (validation + response contracts) · `pino`/`pino-http` · `node-cron` · `axios-retry` + `opossum` · `lru-cache` · `helmet` CSP config · Vitest + supertest + `mongodb-memory-server` + Playwright + jest-axe · GitHub Actions · Sentry · UptimeRobot · Renovate · gitleaks · `.nvmrc` (Node 20).
**Sentiment:** FinBERT (ONNX microservice or HF Inference API) **or** LLM batch classifier (Claude Haiku / GPT-4o-mini) with aggressive hash-keyed caching; VADER retained as fallback.
**Market data:** Binance klines (crypto) + Alpaca IEX / Finnhub / Tiingo (equities).
**Backtesting:** GDELT (news) + Binance/Tiingo (prices) → DuckDB/Parquet + a seeded notebook/script.
**Add later (not now):** Redis (cache + socket adapter, when multi-instance) · prom-client + Grafana Cloud · Dockerfile.
**Do not adopt:** Kafka, Kubernetes, microservices, GraphQL, Next.js/SSR, Nx/Turbo, ELK/Datadog, OpenTelemetry collectors, any broker/execution integration.

### "Do Not Build This"
Message brokers (Kafka/RabbitMQ) · Kubernetes / container orchestration · microservices split of a two-endpoint API · GraphQL · multi-region / HA infra · a custom charting library (keep TradingView) · real order execution / broker integration · blockchain / web3 anything · self-hosted observability fleet (ELK, Prometheus+Grafana+Loki, Datadog) · CQRS / event sourcing · a feature-store product · LLM fine-tuning · SSR migration · monorepo tooling · social / community / copy-trading features · portfolio & position-sizing tooling (regulatory exposure) · native mobile apps · i18n — none of these are justified at this project's stage and several would actively hurt it.

---

*End of audit. Awaiting approval of scope/priorities before any implementation.*
