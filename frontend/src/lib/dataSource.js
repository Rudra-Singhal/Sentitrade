export const DATA_SOURCE = {
  LIVE: "live",
  CACHED: "cached",
  DELAYED: "delayed",
  SIMULATED: "simulated",
  UNAVAILABLE: "unavailable"
};

const RANK = {
  [DATA_SOURCE.LIVE]: 0,
  [DATA_SOURCE.DELAYED]: 1,
  [DATA_SOURCE.CACHED]: 2,
  [DATA_SOURCE.SIMULATED]: 3,
  [DATA_SOURCE.UNAVAILABLE]: 4
};

export const worstSource = (...labels) => {
  const present = labels.filter(Boolean);
  if (!present.length) return DATA_SOURCE.UNAVAILABLE;
  return present.reduce((acc, cur) => (RANK[cur] > RANK[acc] ? cur : acc));
};

export const isRealSource = (label) =>
  label === DATA_SOURCE.LIVE || label === DATA_SOURCE.DELAYED || label === DATA_SOURCE.CACHED;

export const describeSource = (label) => {
  switch (label) {
    case DATA_SOURCE.LIVE:
      return { text: "Live", tone: "positive", help: "Fetched fresh from a live provider." };
    case DATA_SOURCE.DELAYED:
      return { text: "Delayed", tone: "info", help: "Real data, but the provider lags real time." };
    case DATA_SOURCE.CACHED:
      return {
        text: "Cached",
        tone: "info",
        help: "Real data from our store, not refreshed this cycle."
      };
    case DATA_SOURCE.SIMULATED:
      return {
        text: "Simulated",
        tone: "warning",
        help: "Synthetic demo data — not real market data."
      };
    case DATA_SOURCE.UNAVAILABLE:
      return { text: "Unavailable", tone: "danger", help: "No live data available right now." };
    default:
      return { text: "Unknown", tone: "neutral", help: "" };
  }
};

export const formatAsOf = (iso) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
};
