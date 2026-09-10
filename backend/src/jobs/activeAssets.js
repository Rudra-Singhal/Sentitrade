const { normalizeAsset } = require("../services/assetService");

// Assets always kept warm so the dashboard is never cold on first load.
const SEED = ["BTC", "ETH", "AAPL"];

// symbol -> reference count (number of connected clients viewing it)
const counts = new Map();

const track = (assetInput) => {
  const symbol = normalizeAsset(assetInput).symbol;
  counts.set(symbol, (counts.get(symbol) || 0) + 1);
  return symbol;
};

const untrack = (assetInput) => {
  const symbol = normalizeAsset(assetInput).symbol;
  const next = (counts.get(symbol) || 0) - 1;
  if (next <= 0) counts.delete(symbol);
  else counts.set(symbol, next);
};

/** Unique list of assets the scheduler should refresh: seeds + anything viewed. */
const list = () => Array.from(new Set([...SEED, ...counts.keys()]));

const isSeed = (symbol) => SEED.includes(symbol);

const _reset = () => counts.clear();

module.exports = { track, untrack, list, isSeed, SEED, _reset };
