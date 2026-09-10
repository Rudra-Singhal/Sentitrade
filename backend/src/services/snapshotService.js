const { getLatestSentiment, getSocialSentiment } = require("./newsService");
const { getCorrelationInsight } = require("./correlationService");
const { createMarketSummary } = require("./summaryService");
const { generateTradeSignal } = require("./signalService");
const { isReal } = require("../lib/dataSource");

const CACHE_MS = 15_000;
const cache = new Map(); // `${asset}:${range}` -> { at, snapshot }

const compute = async (asset, range) => {
  const [sentiment, social] = await Promise.all([
    getLatestSentiment(asset, 20, false),
    getSocialSentiment(asset)
  ]);
  const correlation = await getCorrelationInsight(sentiment.asset, range);
  const signal = generateTradeSignal({ sentiment, correlation });

  const divergence =
    isReal(sentiment.data_source) && social.score_percent !== null
      ? Number((sentiment.score_percent - social.score_percent).toFixed(1))
      : null;

  return {
    sentiment: {
      ...sentiment,
      signal,
      summary: createMarketSummary({ sentiment, correlation }),
      social,
      news_retail_divergence: divergence
    },
    correlation: { ...correlation, signal }
  };
};

/** Cached market snapshot for one (asset, range). Reads only — never ingests. */
const getSnapshot = async (asset = "BTC", range = "1h", { fresh = false } = {}) => {
  const key = `${String(asset).toUpperCase()}:${range}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.snapshot;

  const snapshot = await compute(asset, range);
  cache.set(key, { at: Date.now(), snapshot });
  return snapshot;
};

const _clear = () => cache.clear();

module.exports = { getSnapshot, _clear };
