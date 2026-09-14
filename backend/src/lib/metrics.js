/**
 * Minimal in-process metrics. Deliberately tiny for M0 — a real
 * prom-client registry arrives in M1. No labels beyond a `:suffix`.
 */
const counters = new Map();
const gauges = new Map();

const inc = (name, by = 1) => {
  counters.set(name, (counters.get(name) || 0) + by);
};

const setGauge = (name, value) => {
  gauges.set(name, value);
};

const markTimestamp = (name) => {
  gauges.set(name, new Date().toISOString());
};

const snapshot = () => ({
  counters: Object.fromEntries(counters),
  gauges: Object.fromEntries(gauges)
});

module.exports = { inc, setGauge, markTimestamp, snapshot };
