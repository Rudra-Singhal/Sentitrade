const { createProviderClient } = require("../lib/httpClient");
const { env } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;

const client = createProviderClient("stocktwits", { timeout: 8000, retries: 1 });

// StockTwits uses a ".X" suffix for crypto cashtags (BTC.X), plain for equities.
const stocktwitsSymbol = (asset) => (asset.type === "crypto" ? `${asset.symbol}.X` : asset.symbol);

/** Pure: StockTwits stream messages -> connector docs. */
const mapMessages = (messages, sinceMs, limit) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => m.body)
    .filter((m) => {
      const ts = m.created_at ? new Date(m.created_at).getTime() : Date.now();
      return !Number.isFinite(ts) || ts >= sinceMs;
    })
    .slice(0, limit)
    .map((m) => ({
      text: m.body,
      title: "",
      url: m.id ? `https://stocktwits.com/message/${m.id}` : null,
      external_id: m.id ? `stocktwits:${m.id}` : null,
      published_at: m.created_at || null,
      author_handle: m.user?.username || null,
      author_followers: m.user?.followers ?? null,
      engagement: {
        likes: m.likes?.total ?? null,
        comments: m.conversation?.replies ?? null
      },
      native_sentiment: m.entities?.sentiment?.basic || null, // "Bullish" | "Bearish" | null
      provider_meta: {
        source_name: "StockTwits",
        cashtags: (m.symbols || []).map((s) => s.symbol)
      }
    }));

/** @type {import("./types").SourceConnector} */
const stocktwitsConnector = {
  id: "stocktwits",
  sourceType: "social",
  cadenceSeconds: 180,
  enabled: true,

  async fetch({ asset, since, limit = 30 }) {
    const sinceMs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
    const params = new URLSearchParams({ limit: String(Math.min(limit, 30)) });
    if (env.STOCKTWITS_TOKEN) params.set("access_token", env.STOCKTWITS_TOKEN);

    const res = await client.get(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(
        stocktwitsSymbol(asset)
      )}.json?${params.toString()}`
    );
    return mapMessages(res.data?.messages, sinceMs, limit);
  },

  async healthcheck() {
    try {
      await client.get("https://api.stocktwits.com/api/2/streams/symbol/AAPL.json?limit=1");
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "stocktwits healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = stocktwitsConnector;
module.exports.mapMessages = mapMessages;
module.exports.stocktwitsSymbol = stocktwitsSymbol;
