const { isUsable } = require("../lib/dataSource");

const DISCLAIMER =
  "Educational tool only. Not investment advice and not a recommendation to buy or sell any asset. Signals are illustrative and have not been backtested.";

const getHeadlineStats = (items = []) => {
  const total = items.length;
  const counts = items.reduce(
    (acc, item) => {
      acc[item.sentiment_label] = (acc[item.sentiment_label] || 0) + 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  return {
    total,
    positiveRatio: total ? Math.round((counts.positive / total) * 100) : 0,
    negativeRatio: total ? Math.round((counts.negative / total) * 100) : 0
  };
};

const pushReason = (reasons, condition, text) => {
  if (condition) reasons.push(text);
};

const getSignalTone = (signal) => {
  if (signal === "BUY") return "bullish";
  if (signal === "SELL") return "bearish";
  return "neutral";
};

// Qualitative label — replaces the old fabricated numeric "confidence %".
const getStrength = (score) => {
  const magnitude = Math.abs(score);
  if (magnitude >= 6) return "high";
  if (magnitude >= 4) return "moderate";
  return "low";
};

const insufficientData = () => ({
  signal: "HOLD",
  tone: "neutral",
  strength: "low",
  score: 0,
  reasons: ["Not enough live data to form a view right now."],
  data_source: "unavailable",
  disclaimer: DISCLAIMER
});

const generateTradeSignal = ({ sentiment, correlation }) => {
  const items = sentiment?.items || [];
  if (!items.length || !isUsable(sentiment?.data_source)) return insufficientData();

  const correlationUsable =
    isUsable(correlation?.data_source) && correlation?.sentiment_change !== null;

  const stats = getHeadlineStats(items);
  const sentimentPercent = sentiment?.score_percent ?? 50;
  const sentimentChange = correlationUsable ? correlation?.sentiment_change ?? 0 : 0;
  const priceChange = correlationUsable ? correlation?.price_change ?? 0 : 0;
  const reasons = [];
  let score = 0;

  if (sentimentPercent >= 62) score += 2;
  else if (sentimentPercent >= 55) score += 1;
  else if (sentimentPercent <= 38) score -= 2;
  else if (sentimentPercent <= 45) score -= 1;

  if (stats.positiveRatio >= 65) score += 2;
  else if (stats.positiveRatio >= 55) score += 1;

  if (stats.negativeRatio >= 60) score -= 2;
  else if (stats.negativeRatio >= 45) score -= 1;

  if (sentimentChange >= 8) score += 2;
  else if (sentimentChange >= 3) score += 1;
  else if (sentimentChange <= -8) score -= 2;
  else if (sentimentChange <= -3) score -= 1;

  if (priceChange >= 0.75) score += 1;
  else if (priceChange <= -0.75) score -= 1;

  let signal = "HOLD";
  if (score >= 4) signal = "BUY";
  if (score <= -4) signal = "SELL";

  pushReason(reasons, sentimentPercent >= 55, `Overall news tone is constructive at ${sentimentPercent}%.`);
  pushReason(reasons, sentimentPercent <= 45, `Overall news tone is weak at ${sentimentPercent}%.`);
  pushReason(reasons, stats.positiveRatio >= 55, `${stats.positiveRatio}% of recent headlines read positive.`);
  pushReason(reasons, stats.negativeRatio >= 45, `${stats.negativeRatio}% of recent headlines read negative.`);
  pushReason(reasons, correlationUsable && sentimentChange >= 3, `News tone improved by ${sentimentChange} points this window.`);
  pushReason(reasons, correlationUsable && sentimentChange <= -3, `News tone fell by ${Math.abs(sentimentChange)} points this window.`);
  pushReason(reasons, correlationUsable && priceChange >= 0.75, `Price is up ${priceChange}% in the selected window.`);
  pushReason(reasons, correlationUsable && priceChange <= -0.75, `Price is down ${Math.abs(priceChange)}% in the selected window.`);
  pushReason(reasons, !correlationUsable, "Price data is unavailable, so only news tone is considered.");
  pushReason(reasons, signal === "HOLD", "Signals are mixed or not strong enough to lean either way.");

  return {
    signal,
    tone: getSignalTone(signal),
    strength: getStrength(score),
    score,
    reasons: reasons.slice(0, 4),
    data_source: sentiment.data_source,
    price_considered: correlationUsable,
    disclaimer: DISCLAIMER
  };
};

module.exports = { generateTradeSignal, DISCLAIMER };
