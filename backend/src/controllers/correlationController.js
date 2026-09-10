const { getCorrelationInsight } = require("../services/correlationService");
const { getLatestSentiment } = require("../services/newsService");
const { generateTradeSignal } = require("../services/signalService");

const getCorrelation = async (req, res) => {
  const { asset, range } = req.validatedQuery;

  const [insight, sentiment] = await Promise.all([
    getCorrelationInsight(asset, range),
    getLatestSentiment(asset, 20, false)
  ]);

  const signal = generateTradeSignal({ sentiment, correlation: insight });

  res.json({ ...insight, signal });
};

module.exports = { getCorrelation };
