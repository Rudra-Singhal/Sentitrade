const { createProviderClient } = require("../lib/httpClient");
const { DATA_SOURCE } = require("../lib/dataSource");
const logger = require("../config/logger");
const { errInfo } = logger;

const fng = createProviderClient("feargreed", { timeout: 7000, retries: 1 });
const wiki = createProviderClient("wikipedia", { timeout: 7000, retries: 1 });

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map();
const cached =
  (key, fn) =>
  async (...args) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await fn(...args);
    cache.set(key, { at: Date.now(), value });
    return value;
  };

const { ASSETS } = require("./assetService");

const wikiArticleFor = (assetSymbol) => {
  const cfg = ASSETS[String(assetSymbol).toUpperCase()];
  return cfg?.wikiArticle || null;
};

/** Pure parsers — unit-tested directly. */
const parseCryptoFng = (payload) => {
  const row = payload?.data?.[0];
  if (!row) return null;
  return {
    value: Number(row.value),
    label: row.value_classification,
    source: "alternative.me",
    data_source: DATA_SOURCE.LIVE
  };
};

const parseEquityFng = (payload) => {
  const fg = payload?.fear_and_greed;
  if (!fg) return null;
  return {
    value: Math.round(fg.score),
    label: fg.rating,
    source: "CNN",
    data_source: DATA_SOURCE.LIVE
  };
};

const computeAttention = (items) => {
  const views = (items || []).map((i) => i.views);
  if (views.length < 4) return null;
  const latest = views[views.length - 1];
  const baseline = views.slice(0, -1).reduce((a, b) => a + b, 0) / (views.length - 1);
  return {
    ratio: baseline ? Number((latest / baseline).toFixed(2)) : null,
    latest,
    baseline: Math.round(baseline),
    source: "Wikipedia",
    data_source: DATA_SOURCE.DELAYED
  };
};

const cryptoFearGreed = cached("fng:crypto", async () =>
  parseCryptoFng((await fng.get("https://api.alternative.me/fng/?limit=1")).data)
);

const equityFearGreed = cached("fng:equity", async () =>
  parseEquityFng(
    (
      await fng.get("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SentiTrade/2.0)" }
      })
    ).data
  )
);

const getFearGreed = async (assetType) => {
  try {
    return assetType === "crypto" ? await cryptoFearGreed() : await equityFearGreed();
  } catch (err) {
    logger.warn({ err: errInfo(err) }, "fear & greed unavailable");
    return null;
  }
};

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

const getAttention = async (assetSymbol) => {
  const article = wikiArticleFor(assetSymbol);
  if (!article) return null;

  return cached(`wiki:${assetSymbol}`, async () => {
    const end = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday (today is incomplete)
    const start = new Date(end.getTime() - 8 * 24 * 60 * 60 * 1000);
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/` +
      `${encodeURIComponent(article)}/daily/${ymd(start)}/${ymd(end)}`;

    try {
      const res = await wiki.get(url, {
        headers: { "User-Agent": "SentiTrade/2.0 (educational)" }
      });
      return computeAttention(res.data?.items);
    } catch (err) {
      logger.warn({ err: errInfo(err), asset: assetSymbol }, "wikipedia attention unavailable");
      return null;
    }
  })();
};

const getMarketContext = async (assetConfig) => {
  const [fearGreed, attention] = await Promise.all([
    getFearGreed(assetConfig.type),
    getAttention(assetConfig.symbol)
  ]);
  return { fear_greed: fearGreed, attention };
};

module.exports = {
  getMarketContext,
  getFearGreed,
  getAttention,
  parseCryptoFng,
  parseEquityFng,
  computeAttention,
  _clearCache: () => cache.clear()
};
