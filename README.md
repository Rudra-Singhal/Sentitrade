# SentiTrade

An **educational** dashboard that puts news-headline sentiment next to price movement for a
single crypto or stock asset, and describes whether the two moved together this window.

> ⚠️ **Not investment advice. Not a price predictor. Not backtested.** The BUY / SELL / HOLD
> label is a transparent rule-based illustration. See [METHODOLOGY.md](./METHODOLOGY.md) for
> exactly how every number is produced and what this project does *not* do. The full technical
> audit is in [AUDIT.md](./AUDIT.md); the v2 plan is in [V2_ROADMAP.md](./V2_ROADMAP.md).

The app shows a live TradingView chart, headline sentiment, a sentiment trend, clear market
metrics, threshold alerts, an illustrative BUY / SELL / HOLD label, and a "sentiment vs price"
panel that describes co-movement over the selected window (not a statistical correlation).

Every value carries a `data_source` badge (`live` / `cached` / `delayed` / `simulated` /
`unavailable`). Simulated demo data is shown only outside production and is always badged;
in production, missing data renders as "—" and is never faked.

## What It Solves

Traders often watch price charts and news separately. This dashboard brings both signals into one screen:

- Price: live TradingView chart.
- Sentiment: NewsAPI headlines scored with VADER (a general-purpose model — see METHODOLOGY.md for why that is a known limitation).
- Trend: average headline sentiment aggregated over time.
- Sentiment vs price: describes whether news tone and price moved the same way this window. This is co-movement of two endpoints, not a predictive correlation.
- Illustrative signal: a transparent rule engine turns news tone, headline mix, sentiment change, and price change into a BUY / SELL / HOLD label with a qualitative strength (weak / moderate / strong alignment — **not** a probability).
- Real time: Socket.io pushes a refreshed snapshot every 30 seconds.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, JSX |
| Styling | Tailwind CSS |
| Charts | Chart.js, react-chartjs-2 |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose |
| Realtime | Socket.io |
| News | NewsAPI |
| Sentiment | vader-sentiment |
| Price UI | TradingView widget (always live) |
| Backend price | Binance klines (crypto) · Yahoo chart API (equities, key-free); `unavailable` on failure in prod |
| Observability | pino structured logs, `/api/ready`, `/api/metrics` |
| Validation | zod (query + socket payloads) |

## Folder Structure

```text
backend/
  src/
    config/        env (zod-validated), logger (pino + redaction), cors, db, sentry
    connectors/    source-connector interface + newsapi / finnhub / rss
    pricing/       binance (crypto) / yahoo (equities) providers + registry
    pipeline/      normalize -> score -> persist -> ingest orchestrator
    jobs/          activeAssets registry + interval scheduler
    models/        RawDocument (canonical multi-source document)
    services/      newsService, priceService, correlationService, signalService,
                   summaryService, snapshotService, socketService
    controllers/ routes/ middleware/ schemas/ lib/
    app.js         pure Express app
    server.js      process entry (bootstrap + graceful shutdown)
  tests/           vitest unit + mongodb-memory-server / socket.io integration
frontend/
  src/
    components/    dashboard panels + DataSourceBadge / GlobalDataBanner /
                   Disclaimer / ErrorBoundary
    pages/Dashboard.jsx
    services/      api (REST, first paint + fallback), socket (live channel)
    lib/           dataSource helpers, sentry
    test/          vitest + React Testing Library + jest-axe
```

## Data Flow

```mermaid
flowchart LR
  subgraph Ingestion["Scheduler — every 120s, per active asset"]
    NewsAPI --> NORM
    Finnhub --> NORM
    RSS --> NORM
    NORM["normalize"] --> SCORE["score (VADER)"] --> PERSIST["upsert by dedupe_key"]
  end
  PERSIST --> Mongo[("RawDocument
(TTL 90d)")]

  subgraph Serving["Reads never ingest"]
    Mongo --> SENT["news / trend"]
    Binance --> PRICE["price series"]
    Yahoo --> PRICE
    SENT --> CORR["co-movement"]
    PRICE --> CORR
    SENT --> SIG["rule signal"]
    CORR --> SIG
    SENT --> SNAP["snapshot (15s cache)"]
    CORR --> SNAP
    SIG --> SNAP
  end

  SNAP --> REST["/api/v1/*"] --> UI["React (first paint)"]
  SNAP --> WS["Socket.io rooms
asset:range"] --> UI2["React (live)"]
```

The only always-live element is the embedded TradingView chart. Every other value
carries a `data_source` label the UI renders as a badge.

## Multi-source pipeline

`backend/src/connectors/` — every provider implements one interface
(`id`, `sourceType`, `cadenceSeconds`, `enabled`, `fetch(ctx)`, `healthcheck()`),
so adding a source touches nothing downstream.

| Connector | Type | Applies to | Key | Notes |
| --- | --- | --- | --- | --- |
| `newsapi` | news | all | `NEWS_API_KEY` | free tier: 100 req/day, delayed articles |
| `finnhub` | news | US equities | `FINNHUB_API_KEY` | company-news, free 60 req/min |
| `gdelt` | news | all | none | GDELT DOC 2.0, free, global coverage (incl. Indian sources); self-throttled — GDELT rate-limits aggressively |
| `rss` | news | crypto, NSE | none | CoinDesk/Cointelegraph/Decrypt/The Block (crypto) or Economic Times/Moneycontrol/LiveMint/Business Standard (India), asset-mention filtered |
| `stocktwits` | social | all | none (optional token) | native Bull/Bear labels used ahead of VADER |
| `reddit` | forum | crypto, US | `REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD` | off by default |
| `twitter` | social | all | `TWITTER_BEARER_TOKEN` or `TWITTERAPI_IO_KEY` | **off by default** — no free tier covers recent search; set either var to enable |
| `edgar` | filing | US equities | none | SEC filings → structured events (earnings, executive change, …) |

Crypto (25), US equities (40) and NSE-listed Indian equities (40) are all
supported — see `backend/src/services/assetService.js` for the full list.

Each connector call is retried (exponential backoff, 429-aware) and wrapped in a
circuit breaker (`opossum`) so a failing provider is skipped for a cooldown.

Documents are normalized to `RawDocument`, deduped by
`sha1(asset + normalized title)` (collapses re-worded wire stories and trailing
`" - Source"` attributions), scored, and `bulkWrite`-upserted. `model` /
`model_version` are stored per document so the VADER -> finance-model swap
planned for a later milestone stays reproducible.

## Prices

- Crypto: Binance klines (`api.binance.com`, no key).
- Equities: Yahoo's key-free chart API, labelled `delayed` (last close) when the
  US session is closed (`lib/marketCalendar.js`).
- `ENABLE_LIVE_PRICE_API=false` is a kill switch; when live data is unavailable
  the panel is `unavailable` in production (never a synthetic series).

## Sentiment

VADER compound score per headline title (`>= 0.05` positive, `<= -0.05` negative,
else neutral), aggregated as an unweighted mean over the latest ~20 documents and
rescaled to `0–100%`. VADER is a general-purpose model and misreads financial
phrasing (e.g. "crushes earnings"); a finance-specific model, relevance filtering,
entity attribution and near-dup clustering are planned. See
[METHODOLOGY.md](./METHODOLOGY.md).

## Sentiment vs price ("correlation")

Compares the **start and end** of the window for news tone and price. If both
moved more than a small threshold in the same direction it reports "moved in the
same direction"; opposite -> "opposite directions"; otherwise "roughly flat".

This is co-movement of two endpoints. It is **not** a correlation coefficient and
carries **no predictive meaning**. A real rolling correlation (`r`, sample size,
confidence interval, lead/lag) is a later milestone.

```json
{
  "asset": "BTC", "range": "1h",
  "sentiment_change": 20, "price_change": 2.5, "current_price": 67350,
  "insight": "Sentiment and price moved in the same direction this window.",
  "note": "Describes how sentiment and price moved this window. Not a predictive correlation.",
  "data_source": "live"
}
```

## Illustrative signal

`backend/src/services/signalService.js` — a transparent rule engine adds/subtracts
integer points from news tone, positive/negative headline ratio, tone change and
price change over the window. `score >= 4` -> BUY, `<= -4` -> SELL, else HOLD. If
inputs are unavailable the label is forced to `HOLD`.

```json
{
  "signal": "BUY", "tone": "bullish", "strength": "moderate", "score": 4,
  "reasons": ["Overall news tone is constructive at 63%.", "65% of recent headlines read positive."],
  "data_source": "live", "price_considered": true,
  "disclaimer": "Educational tool only. Not investment advice and not a recommendation to buy or sell any asset. Signals are illustrative and have not been backtested."
}
```

`strength` (weak / moderate / strong alignment) reflects the magnitude of the rule
score **only**. It is **not** a probability and **not** a confidence that the call
is correct — there is no backtest behind it. It is not a prediction model.

## Frontend UI

The dashboard is a single fintech trading surface:

- Left panel: TradingView chart.
- Right panel: sentiment gauge, correlation insight, and live news.
- Lower panels: sentiment trend line chart and market metrics.
- Top controls: asset selector, time filter, manual refresh.
- Alerts: trigger when sentiment crosses high or low thresholds.

The UI uses:

- Dark background.
- Neon green and cyan market accents.
- Glass panels with `bg-white/[0.055]`, `backdrop-blur`, and subtle borders.
- Compact controls designed for repeated trading-style use.

## Market Metrics Panel

The previous color-grid panel has been replaced with a clearer metrics panel. It shows:

- News Volume: number of latest headlines analyzed for the selected asset.
- Positive Ratio: percentage of headlines labeled positive.
- Sentiment Move: movement between the first and latest sentiment trend point.
- Price Move: backend correlation price movement over the selected time range.
- Headline Mix: simple distribution bar for positive, neutral, and negative headlines.
- Illustrative signal: BUY, SELL, or HOLD with a qualitative strength and reasons.

This is easier to explain in a demo because every number has a direct label and business meaning.

## API Reference

### Health

```http
GET /api/health   # liveness — process is up
GET /api/ready    # readiness — DB connected, data pipeline healthy (503 if degraded)
GET /api/metrics  # in-process counters (fetch outcomes, suppressed-simulated count, ...)
```

### Assets

```http
GET /api/v1/assets
```

Returns supported assets:

```json
{
  "assets": [
    { "symbol": "BTC", "displayName": "Bitcoin", "type": "crypto" },
    { "symbol": "ETH", "displayName": "Ethereum", "type": "crypto" },
    { "symbol": "AAPL", "displayName": "Apple", "type": "stock" }
  ]
}
```

### Latest Sentiment

```http
GET /api/v1/sentiment?asset=BTC&range=1h
```

Returns:

- Average sentiment score.
- Sentiment percent.
- Sentiment label.
- Latest analyzed headlines.
- BUY / SELL / HOLD signal.
- AI-style heuristic summary.

### Sentiment Trend

```http
GET /api/v1/sentiment/trend?asset=BTC&range=1h
```

Supported ranges:

- `5m`
- `1h`
- `24h`

### Correlation

```http
GET /api/v1/correlation?asset=BTC&range=1h
```

Returns sentiment change, price change, current price, insight label, and BUY / SELL / HOLD signal.

## Socket Events

### Client to Server

```js
socket.emit("asset:change", {
  asset: "BTC",
  range: "1h"
});
```

### Server to Client

```js
socket.emit("sentiment:update", {
  sentiment,
  correlation
});
```

### Error Event

```js
socket.emit("sentiment:error", "Error message");
```

## Setup

Install backend dependencies:

```bash
cd backend
npm install
cp .env.example .env
```

Install frontend dependencies:

```bash
cd frontend
npm install
cp .env.example .env
```

## Environment Variables

Backend `.env` (see `backend/.env.example`):

```bash
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sentiment-dashboard
NEWS_API_KEY=your_newsapi_key
ENABLE_LIVE_PRICE_API=true
LOG_LEVEL=info
```

Frontend `.env`:

```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

In **development only**, if `MONGODB_URI` or `NEWS_API_KEY` are empty the backend serves
synthetic demo data, clearly badged `simulated` in the UI. In **production** (`NODE_ENV=production`)
the server refuses to start without `MONGODB_URI` and a client URL, and never substitutes
synthetic data — unavailable values are returned as `unavailable` and shown as "—".

`ENABLE_LIVE_PRICE_API` is `true` by default: the backend pulls real prices from Binance (crypto) and Yahoo's key-free chart API (equities) for the correlation panel. Set it to `false` only as a kill switch; the panel then reports `unavailable` in production.

## Running The App

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

Vite also prints a Network URL such as:

```text
http://10.10.2.152:5173
```

In development, SentiTrade automatically points API and Socket.io traffic to the same host on port `3000`. For example, opening `http://10.10.2.152:5173` calls:

```text
http://10.10.2.152:3000/api
ws://10.10.2.152:3000
```

The backend CORS policy allows localhost and private-network Vite origins only in development. Production still uses the explicit `CLIENT_URL` / `FRONTEND_URL` allowlist.

The default local backend port is `3000`. If you use another backend port, update both frontend values together:

```bash
cd backend
PORT=4000 CLIENT_URL=http://localhost:5173 npm run dev
```

Then run the frontend with matching API URLs:

```bash
cd frontend
VITE_API_URL=http://localhost:4000/api/v1 VITE_SOCKET_URL=http://localhost:4000 npm run dev
```

## Deployment

Recommended production setup:

- Backend: Render Web Service.
- Frontend: Vercel Vite app.
- Database: MongoDB Atlas.
- Secrets: configured in hosting dashboards, never committed to Git.

Official docs used for this setup:

- [Render Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
- [Vercel Vite Deployment Docs](https://vercel.com/docs/frameworks/vite)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

### Pre-Deployment Checklist

1. Push this project to GitHub.
2. Create a MongoDB Atlas cluster.
3. Create a MongoDB database user.
4. Allow network access for your hosting provider. For a hackathon demo, `0.0.0.0/0` is the quickest option; for production, restrict it.
5. Get a NewsAPI key.
6. Keep `.env` files local only. Use `.env.example` and `.env.production.example` as templates.

### Backend Deployment On Render

Create a new Render Web Service:

1. Go to Render and choose `New +` -> `Web Service`.
2. Connect your GitHub repository.
3. Select the backend folder as the root directory:

```text
backend
```

4. Use these commands:

```bash
Build Command: npm ci
Start Command: npm start
```

5. Add environment variables:

```bash
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sentiment-dashboard
NEWS_API_KEY=your_newsapi_key
ENABLE_LIVE_PRICE_API=true
RATE_LIMIT_PER_MINUTE=120
```

6. Health check path:

```text
/api/ready
```

7. Deploy and copy the backend URL. It will look like:

```text
https://your-backend-name.onrender.com
```

Backend production checks:

```text
https://your-backend-name.onrender.com/
https://your-backend-name.onrender.com/api/health
https://your-backend-name.onrender.com/api/v1/assets
```

### Frontend Deployment On Vercel

Create a Vercel project:

1. Import the same GitHub repository.
2. Set the root directory to:

```text
frontend
```

3. Vercel detects Vite automatically. Keep:

```bash
Build Command: npm run build
Output Directory: dist
```

4. Add environment variables:

```bash
VITE_API_URL=https://your-backend-name.onrender.com/api/v1
VITE_SOCKET_URL=https://your-backend-name.onrender.com
```

Vite exposes frontend environment variables only when they use the `VITE_` prefix, which is why both deployed frontend variables start with `VITE_`.

5. Deploy and copy the frontend URL. It will look like:

```text
https://your-frontend-domain.vercel.app
```

6. Go back to Render and update:

```bash
CLIENT_URL=https://your-frontend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

7. Redeploy the Render backend after changing these variables.

### One-Platform Option: Render Blueprint

This repo includes [render.yaml](./render.yaml), which can create both:

- `sentitrade-api`
- `sentitrade-web`

Steps:

1. Push the repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select this repo.
4. Render will read `render.yaml` from the repo root.
5. Fill the required `sync: false` environment variables:

Backend:

```bash
CLIENT_URL=https://your-render-static-site.onrender.com
FRONTEND_URL=https://your-render-static-site.onrender.com
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sentiment-dashboard
NEWS_API_KEY=your_newsapi_key
```

Frontend:

```bash
VITE_API_URL=https://your-render-api.onrender.com/api/v1
VITE_SOCKET_URL=https://your-render-api.onrender.com
```

This option is convenient, but the Render backend URL may not be known until after the first deploy. If that happens, deploy once, copy the generated URL, set the frontend env vars, then redeploy the frontend service.

### Production Smoke Test

After deployment, test these in the browser:

```text
https://your-backend-name.onrender.com/api/health
https://your-backend-name.onrender.com/api/v1/sentiment?asset=BTC&range=1h
https://your-backend-name.onrender.com/api/v1/correlation?asset=BTC&range=1h
https://your-frontend-domain.vercel.app
```

Then open browser DevTools:

- Confirm API requests return `200`.
- Confirm Socket.io connects to the deployed backend URL.
- Confirm no CORS errors appear.
- Confirm TradingView chart loads.

### Deployment Files Added

- `render.yaml`: Render Blueprint for backend and frontend.
- `backend/Procfile`: process declaration for Heroku-style platforms.
- `frontend/vercel.json`: Vercel SPA rewrite and asset caching config.
- `backend/.env.production.example`: backend production env template.
- `frontend/.env.production.example`: frontend production env template.

### Production Hardening Included

- CORS allowlist via `CLIENT_URL` / `FRONTEND_URL`.
- Socket.io CORS uses the same allowlist.
- `helmet` security headers.
- `compression` for API responses.
- `express-rate-limit` on `/api`.
- JSON request size limit.
- Proxy-aware Express config for Render.
- Graceful shutdown on `SIGTERM` / `SIGINT`.
- Root API status route at `/`.

## Build & Test Checks

Frontend production build:

```bash
cd frontend
npm run build
```

Backend lint + tests:

```bash
cd backend
npm run lint && npm test
```

## Production Notes

- Store secrets in the host dashboard, never in source. The backend refuses to
  start in production without `MONGODB_URI` and a client URL.
- Restrict MongoDB Atlas network access to your host's egress IPs. Do **not**
  leave it open to `0.0.0.0/0`, and use a generated password + least-privilege user.
- Synthetic data is suppressed entirely when `NODE_ENV=production`; missing data
  is returned as `unavailable`. The `simulated_data_suppressed_total` metric
  should stay at zero in a healthy production deployment.
- `NEWS_API_KEY` free tier is 100 requests/day and its terms exclude production
  use; the scheduler polls conservatively and the app degrades to `unavailable`
  rather than faking data when the quota is exhausted.
- Point an uptime monitor (e.g. UptimeRobot) at `/api/ready`, and set
  `SENTRY_DSN` / `VITE_SENTRY_DSN` for error tracking.
- The free Render plan sleeps after inactivity; the scheduler restarts on wake.

## Hackathon Demo Script

1. Open the dashboard and point out the live TradingView chart.
2. Switch between BTC, ETH, and AAPL.
3. Change time filters between `5m`, `1h`, and `24h`.
4. Show the sentiment gauge and explain Vader headline scoring.
5. Show the BUY / SELL / HOLD signal and explain that it is rule-based and transparent.
6. Show the trend chart and market metrics panel.
7. Open the correlation box and explain how sentiment movement is compared with price movement.
8. Mention Socket.io refreshes the market signal every 30 seconds.
9. Explain that the app works with real NewsAPI/MongoDB keys but has fallback data for stable demos.
