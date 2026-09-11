/**
 * Provenance label attached to every data-bearing field the API returns.
 * The frontend renders this so a user can always tell live data from
 * cached, delayed, simulated, or missing data.
 */
const DATA_SOURCE = Object.freeze({
  LIVE: "live", // fetched fresh from a real provider this request/cycle
  CACHED: "cached", // real data from our store, not refreshed this cycle
  DELAYED: "delayed", // real provider, but the provider itself lags real time
  SIMULATED: "simulated", // synthetic — only ever returned outside production
  UNAVAILABLE: "unavailable" // no real data and synthetic is suppressed
});

const RANK = {
  [DATA_SOURCE.LIVE]: 0,
  [DATA_SOURCE.DELAYED]: 1,
  [DATA_SOURCE.CACHED]: 2,
  [DATA_SOURCE.SIMULATED]: 3,
  [DATA_SOURCE.UNAVAILABLE]: 4
};

/** Combine several provenance labels into the least-trustworthy one. */
const worst = (...labels) => {
  const present = labels.filter(Boolean);
  if (!present.length) return DATA_SOURCE.UNAVAILABLE;
  return present.reduce((acc, cur) => (RANK[cur] > RANK[acc] ? cur : acc));
};

const isReal = (label) =>
  label === DATA_SOURCE.LIVE || label === DATA_SOURCE.DELAYED || label === DATA_SOURCE.CACHED;

// "we have data to work with" — real OR simulated (dev/demo). Excludes only `unavailable`.
const isUsable = (label) => Boolean(label) && label !== DATA_SOURCE.UNAVAILABLE;

module.exports = { DATA_SOURCE, worst, isReal, isUsable };
