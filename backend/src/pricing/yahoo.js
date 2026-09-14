const { createProviderClient } = require("../lib/httpClient");
const { DATA_SOURCE } = require("../lib/dataSource");
const { isMarketOpen } = require("../lib/marketCalendar");

// Unofficial but widely used and key-free. Wrapped in a breaker; on failure the
// caller falls back to unavailable (prod) / simulated (dev).
const client = createProviderClient("yahoo", { timeout: 8000, retries: 2 });

// `range` is deliberately wider than the window we actually want: Yahoo's
// intraday endpoint measures "range" against its own day boundary (UTC), so
// `range: "1d"` returns ZERO bars once the market has been closed since that
// boundary passed — confirmed live against TCS.NS: 0 bars at range=1d, 50 at
// range=2d, for the exact same request otherwise. `mapChart`'s own windowing
// (below) already narrows down to what was actually asked for, or falls back
// to the tail of the last session when the market's closed — widening `range`
// here just makes sure there is data for it to choose from in the first place.
const PLAN = {
  "5m": { interval: "1m", range: "2d" },
  "1h": { interval: "2m", range: "2d" },
  "24h": { interval: "15m", range: "5d" }
};

const round2 = (n) => Number(Number(n).toFixed(2));

/**
 * Pure: Yahoo chart payload -> price series, preferring the requested window
 * but falling back to the tail of the session when the market is closed and
 * the window would otherwise be empty (last close is still real data).
 *
 * Carries open/high/low alongside close (Yahoo's response has all four; only
 * close was ever read before) so a candlestick chart can be drawn directly
 * from this series — see pipeline for PriceChart.jsx / GET /api/v1/price.
 * `price` (= close) is kept as its own field for every existing consumer
 * that only ever wanted a line series.
 */
const mapChart = (payload, sinceMs) => {
  const result = payload?.chart?.result?.[0];
  const stamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const { close = [], open = [], high = [], low = [] } = quote;

  const all = [];
  for (let i = 0; i < stamps.length; i += 1) {
    if (close[i] == null) continue;
    all.push({
      timestamp: new Date(stamps[i] * 1000).toISOString(),
      price: round2(close[i]),
      open: open[i] != null ? round2(open[i]) : round2(close[i]),
      high: high[i] != null ? round2(high[i]) : round2(close[i]),
      low: low[i] != null ? round2(low[i]) : round2(close[i]),
      close: round2(close[i]),
      ms: stamps[i] * 1000
    });
  }

  const windowed = all.filter((p) => p.ms >= sinceMs);
  const chosen = windowed.length >= 2 ? windowed : all.slice(-12);
  return chosen.map(({ ms, ...point }) => point); // eslint-disable-line no-unused-vars
};

const yahooProvider = {
  id: "yahoo",
  appliesTo: (asset) => asset.type === "stock",

  async fetch(asset, range, sinceMs) {
    const plan = PLAN[range] || PLAN["1h"];
    const symbol = asset.yahooSymbol || asset.symbol;
    const params = new URLSearchParams({ interval: plan.interval, range: plan.range });
    const res = await client.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`
    );
    const series = mapChart(res.data, sinceMs);
    // Real data either way; label as delayed when the session is closed (last close).
    const price_source = isMarketOpen(asset.exchange) ? DATA_SOURCE.LIVE : DATA_SOURCE.DELAYED;
    return { series, price_source };
  },

  async healthcheck() {
    try {
      await client.get(
        "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d"
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: err.message };
    }
  }
};

module.exports = yahooProvider;
module.exports.mapChart = mapChart;
module.exports.PLAN = PLAN;
