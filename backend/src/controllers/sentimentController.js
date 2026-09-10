const { getLatestSentiment, getSentimentTrend } = require("../services/newsService");
const { getCorrelationInsight } = require("../services/correlationService");
const { createMarketSummary } = require("../services/summaryService");
const { generateTradeSignal } = require("../services/signalService");

const getSentiment = async (req, res) => {
  const { asset, range, limit, refresh } = req.validatedQuery;

  const snapshot = await getLatestSentiment(asset, limit, refresh);
  const correlation = await getCorrelationInsight(snapshot.asset, range);
  const signal = generateTradeSignal({ sentiment: snapshot, correlation });

  res.json({
    ...snapshot,
    signal,
    correlation_data_source: correlation.data_source,
    summary: createMarketSummary({ sentiment: snapshot, correlation })
  });
};

const getTrend = async (req, res) => {
  const { asset, range } = req.validatedQuery;
  res.json(await getSentimentTrend(asset, range));
};

module.exports = { getSentiment, getTrend };
