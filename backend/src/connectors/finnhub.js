const { createProviderClient } = require("../lib/httpClient");
const { env } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;

const client = createProviderClient("finnhub", { timeout: 9000, retries: 2 });

const ymd = (date) => date.toISOString().slice(0, 10);

/** Pure: Finnhub company-news rows -> connector docs. */
const mapCompanyNews = (rows, limit = 25) =>
  (Array.isArray(rows) ? rows : [])
    .filter((r) => r.headline)
    .slice(0, limit)
    .map((r) => ({
      text: r.headline,
      title: r.headline,
      url: r.url || null,
      external_id: r.id ? `finnhub:${r.id}` : r.url || null,
      published_at: r.datetime ? new Date(r.datetime * 1000).toISOString() : null,
      provider_meta: {
        source_name: r.source || "Finnhub",
        category: r.category || null,
        summary: r.summary || null
      }
    }));

/** @type {import("./types").SourceConnector} */
const finnhubConnector = {
  id: "finnhub",
  sourceType: "news",
  cadenceSeconds: 300,
  get enabled() {
    return Boolean(env.FINNHUB_API_KEY);
  },

  // Finnhub company-news is equities only on the free tier.
  appliesTo: (asset) => asset.type === "stock",

  async fetch({ asset, since, limit = 25 }) {
    if (!env.FINNHUB_API_KEY) return [];

    const from = ymd(since || new Date(Date.now() - 24 * 60 * 60 * 1000));
    const to = ymd(new Date());
    const params = new URLSearchParams({
      symbol: asset.symbol,
      from,
      to,
      token: env.FINNHUB_API_KEY
    });

    const res = await client.get(`https://finnhub.io/api/v1/company-news?${params.toString()}`);
    return mapCompanyNews(res.data, limit);
  },

  async healthcheck() {
    if (!env.FINNHUB_API_KEY) return { ok: false, detail: "no FINNHUB_API_KEY" };
    try {
      await client.get(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${env.FINNHUB_API_KEY}`);
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "finnhub healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = finnhubConnector;
module.exports.mapCompanyNews = mapCompanyNews;
