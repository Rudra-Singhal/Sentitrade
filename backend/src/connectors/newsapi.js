const { createProviderClient } = require("../lib/httpClient");
const { env } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;

const client = createProviderClient("newsapi", { timeout: 9000, retries: 2 });

/** @type {import("./types").SourceConnector} */
const newsapiConnector = {
  id: "newsapi",
  sourceType: "news",
  cadenceSeconds: 300,
  get enabled() {
    return Boolean(env.NEWS_API_KEY);
  },

  async fetch({ asset, limit = 20 }) {
    if (!env.NEWS_API_KEY) return [];

    // NewsAPI's free plan lags ~24h and can return month-old articles — floor
    // the request at 3 days and drop anything older client-side. The freshness
    // of what comes back is reflected in `data_source` downstream.
    const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      q: asset.query,
      language: "en",
      from: from.toISOString(),
      pageSize: String(Math.min(limit, 100)),
      sortBy: "publishedAt",
      apiKey: env.NEWS_API_KEY
    });

    const res = await client.get(`https://newsapi.org/v2/everything?${params.toString()}`);
    const articles = res.data?.articles || [];
    const fromMs = from.getTime();

    return articles
      .filter((a) => a.title && (!a.publishedAt || new Date(a.publishedAt).getTime() >= fromMs))
      .map((a) => ({
        text: a.title,
        title: a.title,
        url: a.url || null,
        external_id: a.url || null,
        published_at: a.publishedAt || null,
        author_handle: a.author || null,
        provider_meta: {
          source_name: a.source?.name || "NewsAPI",
          description: a.description || null
        }
      }));
  },

  async healthcheck() {
    if (!env.NEWS_API_KEY) return { ok: false, detail: "no NEWS_API_KEY" };
    try {
      await client.get(
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${env.NEWS_API_KEY}`
      );
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "newsapi healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = newsapiConnector;
