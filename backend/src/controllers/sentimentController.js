const { getSentimentTrend } = require("../services/newsService");
const { getSnapshot } = require("../services/snapshotService");

const getSentiment = async (req, res) => {
  const { asset, range } = req.validatedQuery;
  const snap = await getSnapshot(asset, range);
  res.json({ ...snap.sentiment, correlation_data_source: snap.correlation.data_source });
};

const getTrend = async (req, res) => {
  const { asset, range } = req.validatedQuery;
  res.json(await getSentimentTrend(asset, range));
};

module.exports = { getSentiment, getTrend };
