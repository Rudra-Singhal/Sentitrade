const mongoose = require("mongoose");
const { env, isProd } = require("../config/env");
const metrics = require("../lib/metrics");

const health = (_req, res) => {
  res.json({ status: "ok", uptime_s: Math.round(process.uptime()) });
};

const ready = (_req, res) => {
  const dbConfigured = Boolean(env.MONGODB_URI);
  const dbConnected = mongoose.connection.readyState === 1;
  const dbOk = dbConnected || (!dbConfigured && !isProd);

  const snap = metrics.snapshot();
  const checks = {
    db: dbOk ? "ok" : "down",
    simulated_data_suppressed_total: snap.counters.simulated_data_suppressed_total || 0,
    last_news_fetch_ok_at: snap.gauges.last_news_fetch_ok_at || null,
    last_price_fetch_ok_at: snap.gauges.last_price_fetch_ok_at || null
  };

  const ok = dbOk;
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded", checks });
};

const showMetrics = (_req, res) => res.json(metrics.snapshot());

module.exports = { health, ready, showMetrics };
