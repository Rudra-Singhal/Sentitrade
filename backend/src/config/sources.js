/**
 * Base credibility weight per source (0..1). Used to weight sentiment
 * aggregation and to pick the canonical document in a near-duplicate
 * cluster. Refined empirically once the backtest exists (M4).
 */
const SOURCE_WEIGHTS = {
  // Wire services / tier-1 financial press
  Reuters: 1.0,
  Bloomberg: 1.0,
  "The Wall Street Journal": 1.0,
  "Associated Press": 1.0,
  "Financial Times": 1.0,
  CNBC: 0.9,
  "Barron's": 0.9,
  MarketWatch: 0.8,
  "The Verge": 0.6,

  // Crypto-native outlets
  CoinDesk: 0.8,
  "The Block": 0.8,
  Cointelegraph: 0.6,
  Decrypt: 0.6,
  CryptoSlate: 0.5,
  CryptoBriefing: 0.5,

  // Our own connectors / aggregators (unknown underlying source)
  NewsAPI: 0.4,
  Finnhub: 0.5,

  // Social / forum (M2.3+)
  stocktwits: 0.4,
  reddit: 0.35,
  "reddit:wallstreetbets": 0.2
};

const DEFAULT_WEIGHT = 0.5;

const weightForSource = (name) => {
  if (!name) return DEFAULT_WEIGHT;
  return SOURCE_WEIGHTS[name] ?? SOURCE_WEIGHTS[String(name).toLowerCase()] ?? DEFAULT_WEIGHT;
};

module.exports = { SOURCE_WEIGHTS, DEFAULT_WEIGHT, weightForSource };
