# SentiTrade

A production-grade hackathon project that compares real-time market price action with news-based sentiment for crypto and stock assets.

The app shows a live TradingView chart, headline sentiment, sentiment trend, a BUY/SELL/HOLD signal, clear market metrics, alerts, and a correlation insight that explains whether sentiment and price are moving together or diverging.

## What It Solves

Traders often watch price charts and news separately. This dashboard brings both signals into one screen:

- Price: live TradingView chart for BTC, ETH, and AAPL.
- Sentiment: NewsAPI headlines analyzed with Vader Sentiment.
- Trend: average sentiment aggregated over time.
- Correlation: compares sentiment movement with price movement.
- Signal: converts sentiment, headline mix, momentum, price movement, and correlation into BUY, SELL, or HOLD.
- Real time: Socket.io pushes refreshed sentiment and correlation data every 30 seconds.

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
| Price UI | TradingView widget |
| Price correlation | CoinGecko for crypto, mock fallback for demo stability |

## Folder Structure

```text
root/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── assetController.js
│   │   │   ├── correlationController.js
│   │   │   ├── healthController.js
│   │   │   └── sentimentController.js
│   │   ├── models/
│   │   │   └── NewsSentiment.js
│   │   ├── routes/
│   │   │   ├── assetRoutes.js
│   │   │   ├── correlationRoutes.js
│   │   │   ├── healthRoutes.js
│   │   │   └── sentimentRoutes.js
│   │   ├── services/
│   │   │   ├── assetService.js
│   │   │   ├── correlationService.js
│   │   │   ├── mockDataService.js
│   │   │   ├── newsService.js
│   │   │   ├── priceService.js
│   │   │   ├── signalService.js
│   │   │   ├── sentimentService.js
│   │   │   ├── socketService.js
│   │   │   └── summaryService.js
│   │   └── app.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── favicon.svg
    ├── src/
    │   ├── components/
    │   │   ├── AlertBanner.jsx
    │   │   ├── AssetSelector.jsx
    │   │   ├── Card.jsx
    │   │   ├── CorrelationBox.jsx
    │   │   ├── NewsFeed.jsx
    │   │   ├── SentimentChart.jsx
    │   │   ├── SentimentGauge.jsx
    │   │   ├── MarketMetrics.jsx
    │   │   ├── TimeFilter.jsx
    │   │   └── TradingViewWidget.jsx
    │   ├── pages/
    │   │   └── Dashboard.jsx
    │   ├── services/
    │   │   ├── api.js
    │   │   └── socket.js
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── .env.example
    └── package.json
```

## Architecture Flowchart

```mermaid
flowchart LR
  User["User Browser"] --> React["React Dashboard"]
  React --> TV["TradingView Widget"]
  React --> API["Express REST API"]
  React <-->|"sentiment:update"| Socket["Socket.io Server"]

  API --> NewsSvc["News Service"]
  API --> TrendSvc["Trend Service"]
  API --> CorrSvc["Correlation Service"]
  API --> SignalSvc["Signal Service"]

  Socket --> NewsSvc
  Socket --> CorrSvc
  Socket --> SignalSvc

  NewsSvc --> NewsAPI["NewsAPI"]
  NewsSvc --> Vader["Vader Sentiment"]
  NewsSvc --> Mongo["MongoDB Atlas"]

  TrendSvc --> Mongo
  CorrSvc --> PriceSvc["Price Service"]
  CorrSvc --> TrendSvc
  PriceSvc --> CoinGecko["CoinGecko"]

  NewsSvc -. "fallback" .-> Mock["Mock Demo Data"]
  PriceSvc -. "fallback" .-> Mock
  SignalSvc --> React
```

## Backend Request Flow

```mermaid
sequenceDiagram
  participant UI as React UI
  participant API as Express API
  participant News as News Service
  participant Vader as Vader Sentiment
  participant DB as MongoDB
  participant Corr as Correlation Service
  participant Price as Price Service
  participant Signal as Signal Service

  UI->>API: GET /api/sentiment?asset=BTC&range=1h
  API->>News: Fetch latest headlines
  News->>Vader: Score each headline
  Vader-->>News: compound score + label
  News->>DB: Upsert headline sentiment
  News-->>API: latest sentiment snapshot
  API->>Corr: Build correlation insight
  Corr->>DB: Read sentiment trend
  Corr->>Price: Read price series
  Price-->>Corr: price_change %
  Corr-->>API: insight
  API->>Signal: Generate BUY / SELL / HOLD
  Signal-->>API: signal, confidence, reasons
  API-->>UI: news, score, label, signal, summary
```

## Real-Time Flow

```mermaid
flowchart TD
  Start["Socket connects"] --> Join["Client sends selected asset + range"]
  Join --> Snapshot["Server builds sentiment + correlation snapshot"]
  Snapshot --> Signal["Generate BUY / SELL / HOLD"]
  Signal --> Emit["Emit sentiment:update"]
  Emit --> UI["React updates gauge, news, chart, metrics, insight"]
  Emit --> Wait["Wait 30 seconds"]
  Wait --> Snapshot
  UI --> Change["User changes asset or time filter"]
  Change --> Join
```

## Sentiment Engine

The sentiment engine lives in `backend/src/services/sentimentService.js`.

It uses Vader compound scores:

| Compound Score | Label |
| --- | --- |
| `>= 0.05` | positive |
| `<= -0.05` | negative |
| between `-0.05` and `0.05` | neutral |

Each headline becomes:

```json
{
  "text": "Bitcoin spot ETF inflows accelerate as institutional demand improves",
  "source": "CoinDesk",
  "sentiment_score": 0.3182,
  "sentiment_label": "positive",
  "asset": "BTC",
  "timestamp": "2026-04-26T07:00:00.000Z"
}
```

## Database Schema

MongoDB stores normalized headline sentiment records:

```js
{
  text: String,
  source: String,
  sentiment_score: Number,
  sentiment_label: "positive" | "neutral" | "negative",
  asset: String,
  timestamp: Date
}
```

Duplicate prevention is handled by a unique index on:

```js
{ text: 1, asset: 1 }
```

This prevents repeated NewsAPI pulls from filling the database with the same headline.

## Aggregation Flow

```mermaid
flowchart LR
  Headlines["Stored headline sentiment"] --> Match["Match asset + time range"]
  Match --> Group["Group by minute"]
  Group --> Average["Average sentiment_score"]
  Average --> Percent["Convert -1..1 score to 0..100%"]
  Percent --> Chart["Frontend line chart + market metrics"]
```

The trend API groups records by minute and returns points like:

```json
{
  "timestamp": "2026-04-26T07:00:00.000Z",
  "sentiment_avg": 0.2065,
  "sentiment_percent": 60,
  "count": 4
}
```

## Correlation Engine

The correlation engine compares:

- Sentiment change over the selected time window.
- Price change over the same time window.

```mermaid
flowchart TD
  Trend["Sentiment trend points"] --> SentDelta["Calculate sentiment_change %"]
  Price["Price series"] --> PriceDelta["Calculate price_change %"]
  SentDelta --> Compare["Compare movement direction"]
  PriceDelta --> Compare
  Compare --> Positive["Positive correlation detected"]
  Compare --> Negative["Negative correlation detected"]
  Compare --> Sideways["Sentiment and price are moving sideways"]
```

Example response:

```json
{
  "asset": "BTC",
  "range": "1h",
  "sentiment_change": 20,
  "price_change": 2.5,
  "current_price": 67350,
  "insight": "Positive correlation detected"
}
```

## Signal Engine

The signal engine lives in `backend/src/services/signalService.js`.

It generates an educational trading signal from the same metrics shown in the UI:

- Overall sentiment score.
- Positive headline ratio.
- Negative headline ratio.
- Sentiment momentum.
- Price movement.
- Correlation direction.

```mermaid
flowchart TD
  Sentiment["Sentiment score"] --> Score["Rule score"]
  Headlines["Positive / negative headline ratio"] --> Score
  Momentum["Sentiment momentum"] --> Score
  Price["Price move"] --> Score
  Corr["Correlation insight"] --> Score
  Score --> Buy["BUY if score >= 4"]
  Score --> Sell["SELL if score <= -4"]
  Score --> Hold["HOLD if score is between -3 and 3"]
  Buy --> Confidence["Confidence + reasons"]
  Sell --> Confidence
  Hold --> Confidence
```

Signal response:

```json
{
  "signal": "BUY",
  "tone": "bullish",
  "confidence": 77,
  "score": 4,
  "reasons": [
    "Overall sentiment is constructive at 63%.",
    "65% of recent headlines are positive.",
    "Sentiment momentum improved by 8 points."
  ],
  "disclaimer": "Educational signal only. Not financial advice."
}
```

This is intentionally rule-based and transparent. It is not a financial prediction model.

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
- Trade Signal: BUY, SELL, or HOLD with confidence and reasons.

This is easier to explain in a demo because every number has a direct label and business meaning.

## API Reference

### Health

```http
GET /api/health
```

Returns:

```text
Server running
```

### Assets

```http
GET /api/assets
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
GET /api/sentiment?asset=BTC&range=1h
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
GET /api/sentiment/trend?asset=BTC&range=1h
```

Supported ranges:

- `5m`
- `1h`
- `24h`

### Correlation

```http
GET /api/correlation?asset=BTC&range=1h
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

Backend `.env`:

```bash
PORT=3000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sentiment-dashboard
NEWS_API_KEY=your_newsapi_key
ENABLE_LIVE_PRICE_API=false
```

Frontend `.env`:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

If `MONGODB_URI` or `NEWS_API_KEY` are empty, the backend uses mock demo data. This keeps the dashboard usable during judging, demos, and offline development.

`ENABLE_LIVE_PRICE_API` is false by default because the UI already uses TradingView for live price and the backend correlation can use stable mock series. Set it to `true` if you want backend crypto correlation to call CoinGecko directly.

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
VITE_API_URL=http://localhost:4000/api VITE_SOCKET_URL=http://localhost:4000 npm run dev
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
ENABLE_LIVE_PRICE_API=false
RATE_LIMIT_PER_MINUTE=120
```

6. Health check path:

```text
/api/health
```

7. Deploy and copy the backend URL. It will look like:

```text
https://your-backend-name.onrender.com
```

Backend production checks:

```text
https://your-backend-name.onrender.com/
https://your-backend-name.onrender.com/api/health
https://your-backend-name.onrender.com/api/assets
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
VITE_API_URL=https://your-backend-name.onrender.com/api
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
VITE_API_URL=https://your-render-api.onrender.com/api
VITE_SOCKET_URL=https://your-render-api.onrender.com
```

This option is convenient, but the Render backend URL may not be known until after the first deploy. If that happens, deploy once, copy the generated URL, set the frontend env vars, then redeploy the frontend service.

### Production Smoke Test

After deployment, test these in the browser:

```text
https://your-backend-name.onrender.com/api/health
https://your-backend-name.onrender.com/api/sentiment?asset=BTC&range=1h
https://your-backend-name.onrender.com/api/correlation?asset=BTC&range=1h
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

## Build Checks

Frontend production build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
cd backend
find src -name "*.js" -print0 | xargs -0 -n1 node --check
```

## Error Fixes Included

The latest version fixes the browser console issues shown during local testing:

- Replaced fragile TradingView script injection with a direct TradingView widget iframe.
- Kept a single stable Socket.io client instead of recreating the socket on every asset or time-filter change.
- Removed React dev StrictMode wrapper to avoid duplicate mount/unmount socket noise during demos.
- Added `frontend/public/favicon.svg` to remove the `/favicon.ico` 404.
- Made backend live price fetching opt-in to avoid CoinGecko rate-limit noise during local demos.
- Changed sentiment change to use percentage-point movement on the normalized sentiment scale, avoiding unrealistic values when raw sentiment starts near zero.

TradingView may still open its own internal streaming connection inside the third-party iframe. If a browser extension or network blocks TradingView streaming, the app remains functional and the backend sentiment/correlation pipeline still works.

## Production Notes

- Store secrets in environment variables, not source code.
- Use MongoDB Atlas IP allowlisting for deployment.
- Add rate-limit protection around NewsAPI routes before public launch.
- Use a managed host such as Render, Railway, Fly.io, or AWS for the Express API.
- Use Vercel or Netlify for the Vite frontend.
- Set frontend environment variables to the deployed backend URL.
- Consider replacing mock stock pricing with a paid market data provider for production AAPL correlation.

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
