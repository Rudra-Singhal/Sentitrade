const { getSentimentTrend } = require("./newsService");
const { getPriceChange } = require("./priceService");
const { DATA_SOURCE, worst, isUsable } = require("../lib/dataSource");

const toSentimentPercent = (score) => ((score + 1) / 2) * 100;

/**
 * Compares how sentiment and price *moved* over the same window.
 *
 * This is co-movement of two endpoints, NOT a statistical correlation and
 * NOT predictive. Wording and fields are intentionally cautious; a real
 * rolling correlation (r, n, CI, lead/lag) arrives in a later milestone.
 */
const getCorrelationInsight = async (asset = "BTC", range = "1h") => {
  const [trend, price] = await Promise.all([
    getSentimentTrend(asset, range),
    getPriceChange(asset, range)
  ]);

  const points = trend.points || [];
  const dataSource = worst(trend.data_source, price.price_source);

  const base = {
    asset: trend.asset,
    range,
    data_source: dataSource,
    note: "Describes how sentiment and price moved this window. Not a predictive correlation.",
    trend: points,
    price_series: price.series || []
  };

  const haveSentiment = points.length >= 2 && isUsable(trend.data_source);
  const havePrice = price.price_change !== null && isUsable(price.price_source);

  if (!haveSentiment || !havePrice) {
    return {
      ...base,
      sentiment_change: haveSentiment
        ? Number(
            (
              toSentimentPercent(points[points.length - 1].sentiment_avg) -
              toSentimentPercent(points[0].sentiment_avg)
            ).toFixed(2)
          )
        : null,
      price_change: havePrice ? price.price_change : null,
      current_price: havePrice ? price.current_price : null,
      insight: "Not enough live data to compare sentiment and price this window."
    };
  }

  const firstSentiment = points[0].sentiment_avg || 0;
  const lastSentiment = points[points.length - 1].sentiment_avg || firstSentiment;
  const sentiment_change = Number(
    (toSentimentPercent(lastSentiment) - toSentimentPercent(firstSentiment)).toFixed(2)
  );

  const sentimentDirection = sentiment_change >= 0 ? 1 : -1;
  const priceDirection = price.price_change >= 0 ? 1 : -1;
  const moved = Math.abs(sentiment_change) >= 2 && Math.abs(price.price_change) >= 0.15;

  let insight = "Sentiment and price were roughly flat this window.";
  if (moved && sentimentDirection === priceDirection) {
    insight = "Sentiment and price moved in the same direction this window.";
  } else if (moved) {
    insight = "Sentiment and price moved in opposite directions this window.";
  }

  return {
    ...base,
    sentiment_change,
    price_change: price.price_change,
    current_price: price.current_price,
    insight
  };
};

module.exports = { getCorrelationInsight, DATA_SOURCE };
