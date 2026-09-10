const { isReal } = require("../lib/dataSource");

/**
 * A plain-language description of *current* conditions. Deliberately avoids
 * forecasting language ("will", "reversal", "momentum building").
 */
const createMarketSummary = ({ sentiment, correlation }) => {
  const label = sentiment?.sentiment_label || "neutral";
  const score = sentiment?.score_percent ?? 50;
  const asset = sentiment?.asset || "This asset";

  if (!isReal(sentiment?.data_source)) {
    return `Live sentiment data for ${asset} is unavailable right now, so no read is shown.`;
  }

  const priceReal = isReal(correlation?.data_source) && correlation?.price_change !== null;

  if (!priceReal) {
    return `${asset} news tone is ${label} at ${score}%. Live price data is unavailable, so no sentiment-vs-price comparison is shown.`;
  }

  const priceMove = correlation.price_change;
  const direction = priceMove >= 0 ? "higher" : "lower";

  if (label === "positive" && priceMove >= 0) {
    return `${asset} news tone is positive at ${score}% and price is trading ${direction} this window. This describes current conditions, not a forecast.`;
  }
  if (label === "negative" && priceMove < 0) {
    return `${asset} news tone is negative at ${score}% and price is trading ${direction} this window.`;
  }
  if (label === "positive" && priceMove < 0) {
    return `${asset} news tone is positive at ${score}% but price is trading ${direction} this window — a mixed picture.`;
  }

  return `${asset} news tone is ${label} at ${score}% with limited price confirmation this window.`;
};

module.exports = { createMarketSummary };
