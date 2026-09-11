const { createProviderClient } = require("../lib/httpClient");
const { DATA_SOURCE } = require("../lib/dataSource");
const { isMarketOpen } = require("../lib/marketCalendar");

// Unofficial but widely used and key-free. Wrapped in a breaker; on failure the
// caller falls back to unavailable (prod) / simulated (dev).
const client = createProviderClient("yahoo", { timeout: 8000, retries: 2 });

const PLAN = {
  "5m": { interval: "1m", range: "1d" },
  "1h": { interval: "2m", range: "1d" },
  "24h": { interval: "15m", range: "5d" }
};

/**
 * Pure: Yahoo chart payload -> price series, preferring the requested window
 * but falling back to the tail of the session when the market is closed and
 * the window would otherwise be empty (last close is still real data).
 */
const mapChart = (payload, sinceMs) => {
  const result = payload?.chart?.result?.[0];
  const stamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  const all = [];
  for (let i = 0; i < stamps.length; i += 1) {
    if (closes[i] == null) continue;
    all.push({
      timestamp: new Date(stamps[i] * 1000).toISOString(),
      price: Number(Number(closes[i]).toFixed(2)),
      ms: stamps[i] * 1000
    });
  }

  const windowed = all.filter((p) => p.ms >= sinceMs);
  const chosen = windowed.length >= 2 ? windowed : all.slice(-12);
  return chosen.map(({ timestamp, price }) => ({ timestamp, price }));
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
