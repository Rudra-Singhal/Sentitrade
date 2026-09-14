const { getLatestSentiment } = require("./newsService");
const { getCorrelationInsight } = require("./correlationService");
const { createMarketSummary } = require("./summaryService");
const { generateTradeSignal } = require("./signalService");

const CACHE_MS = 15_000;
const cache = new Map(); // `${asset}:${range}` -> { at, snapshot }

const compute = async (asset, range) => {
  const sentiment = await getLatestSentiment(asset, 20, false);
  const correlation = await getCorrelationInsight(sentiment.asset, range);
  const signal = generateTradeSignal({ sentiment, correlation });

  return {
    sentiment: { ...sentiment, signal, summary: createMarketSummary({ sentiment, correlation }) },
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
