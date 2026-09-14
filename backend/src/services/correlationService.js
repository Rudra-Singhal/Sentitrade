const { getSentimentTrend } = require("./newsService");
const { getPriceChange } = require("./priceService");
const { DATA_SOURCE, worst, isUsable } = require("../lib/dataSource");

const toSentimentPercent = (score) => ((score + 1) / 2) * 100;

const NOTE = "Describes how sentiment and price moved this window. Not a predictive correlation.";
const INSUFFICIENT = "Not enough live data to compare sentiment and price this window.";

const computeSentimentChange = (points = []) => {
  if (points.length < 2) return null;
  const first = points[0].sentiment_avg ?? 0;
  const last = points[points.length - 1].sentiment_avg ?? first;
  return Number((toSentimentPercent(last) - toSentimentPercent(first)).toFixed(2));
};

/**
 * Classify co-movement of two endpoint deltas. Pure. Thresholds are small
 * and deliberately labelled as description, not prediction.
 */
const classifyCoMovement = (sentimentChange, priceChange) => {
  const moved = Math.abs(sentimentChange) >= 2 && Math.abs(priceChange) >= 0.15;
  if (!moved) return "Sentiment and price were roughly flat this window.";
  const sameDirection = sentimentChange >= 0 === priceChange >= 0;
  return sameDirection
    ? "Sentiment and price moved in the same direction this window."
    : "Sentiment and price moved in opposite directions this window.";
};

/**
 * Build the insight object from already-fetched trend + price. Pure —
 * unit-tested directly without mocking the data providers.
 */
const buildInsight = ({ trend, price, range = "1h" }) => {
  const points = trend.points || [];
  const base = {
    asset: trend.asset,
    range,
    data_source: worst(trend.data_source, price.price_source),
    note: NOTE,
    trend: points,
    price_series: price.series || []
  };

  const haveSentiment = points.length >= 2 && isUsable(trend.data_source);
  const havePrice = price.price_change !== null && isUsable(price.price_source);
  const sentimentChange = computeSentimentChange(points);

  if (!haveSentiment || !havePrice) {
    return {
      ...base,
      sentiment_change: haveSentiment ? sentimentChange : null,
      price_change: havePrice ? price.price_change : null,
      current_price: havePrice ? price.current_price : null,
      insight: INSUFFICIENT
    };
  }

  return {
    ...base,
    sentiment_change: sentimentChange,
    price_change: price.price_change,
    current_price: price.current_price,
    insight: classifyCoMovement(sentimentChange, price.price_change)
  };
};

const getCorrelationInsight = async (asset = "BTC", range = "1h") => {
  const [trend, price] = await Promise.all([
    getSentimentTrend(asset, range),
    getPriceChange(asset, range)
  ]);
  return buildInsight({ trend, price, range });
};

module.exports = {
  getCorrelationInsight,
  buildInsight,
  classifyCoMovement,
  computeSentimentChange,
  DATA_SOURCE
};
