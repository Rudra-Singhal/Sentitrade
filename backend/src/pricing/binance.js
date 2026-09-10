const { createProviderClient } = require("../lib/httpClient");
const { DATA_SOURCE } = require("../lib/dataSource");

const client = createProviderClient("binance", { timeout: 8000, retries: 2 });

// window -> { interval, limit } for Binance klines
const PLAN = {
  "5m": { interval: "1m", limit: 30 },
  "1h": { interval: "1m", limit: 90 },
  "24h": { interval: "15m", limit: 100 }
};

const toBinanceSymbol = (asset) => {
  const tv = asset.tradingViewSymbol || "";
  if (tv.startsWith("BINANCE:")) return tv.slice("BINANCE:".length);
  return `${asset.symbol}USDT`;
};

/** Pure: Binance kline rows -> our price series, filtered to the window. */
const mapKlines = (rows, sinceMs) =>
  (Array.isArray(rows) ? rows : [])
    .filter((k) => Array.isArray(k) && k[0] >= sinceMs)
    .map((k) => ({
      timestamp: new Date(k[0]).toISOString(),
      price: Number(Number(k[4]).toFixed(2))
    }));

const binanceProvider = {
  id: "binance",
  appliesTo: (asset) => asset.type === "crypto",

  async fetch(asset, range, sinceMs) {
    const plan = PLAN[range] || PLAN["1h"];
    const params = new URLSearchParams({
      symbol: toBinanceSymbol(asset),
      interval: plan.interval,
      limit: String(plan.limit)
    });
    const res = await client.get(`https://api.binance.com/api/v3/klines?${params.toString()}`);
    return { series: mapKlines(res.data, sinceMs), price_source: DATA_SOURCE.LIVE };
  },

  async healthcheck() {
    try {
      await client.get("https://api.binance.com/api/v3/ping");
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: err.message };
    }
  }
};

module.exports = binanceProvider;
module.exports.mapKlines = mapKlines;
module.exports.toBinanceSymbol = toBinanceSymbol;
