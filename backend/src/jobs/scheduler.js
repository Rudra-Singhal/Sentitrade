const pLimit = require("p-limit");
const mongoose = require("mongoose");
const { ingestAsset } = require("../pipeline/ingest");
const { computeAndStoreFeatures } = require("../pipeline/featureStore");
const activeAssets = require("./activeAssets");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");

const NEWS_INTERVAL_MS = 120_000;
const limit = pLimit(2);

// Matches the ranges the frontend already offers (5m/1h/24h) — the feature
// store is built for the buckets something downstream actually reads.
const FEATURE_BUCKET_MINUTES = [5, 60, 1440];

/** Refresh every bucket size for one asset. Never throws — a feature-store
 * failure must not affect ingestion, which this always runs after. */
const refreshFeatures = async (asset) => {
  await Promise.all(
    FEATURE_BUCKET_MINUTES.map((minutes) =>
      computeAndStoreFeatures(asset, minutes).catch((err) => {
        logger.warn({ asset, minutes, err: errInfo(err) }, "feature refresh failed");
      })
    )
  );
};

// symbol -> ISO timestamp of the last ingest that actually returned documents
const lastIngestAt = new Map();
const getLastIngestAt = (symbol) => lastIngestAt.get(String(symbol).toUpperCase()) || null;

let newsTimer = null;
let running = false;

const runNewsIngest = async () => {
  if (running || mongoose.connection.readyState !== 1) return;
  running = true;
  const started = Date.now();
  const assets = activeAssets.list();

  try {
    await Promise.all(
      assets.map((asset) =>
        limit(async () => {
          try {
            const result = await ingestAsset(asset, {
              limit: 30,
              types: ["news", "social", "forum", "filing"]
            });
            if (result.fetchedAny) lastIngestAt.set(asset, new Date().toISOString());
            metrics.inc(`scheduler_ingest_total:${asset}`);
            await refreshFeatures(asset);
          } catch (err) {
            metrics.inc("scheduler_ingest_errors_total");
            logger.warn({ asset, err: errInfo(err) }, "scheduled ingest failed");
          }
        })
      )
    );
    metrics.setGauge("scheduler_last_run_ms", Date.now() - started);
    metrics.markTimestamp("scheduler_last_run_at");
    logger.info({ assets: assets.length, ms: Date.now() - started }, "news ingest cycle complete");
  } finally {
    running = false;
  }
};

/** Ingest one asset immediately (used when an asset first becomes active). */
const ingestNow = async (asset) => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const result = await ingestAsset(asset, {
      limit: 30,
      types: ["news", "social", "forum", "filing"]
    });
    if (result.fetchedAny) lastIngestAt.set(String(asset).toUpperCase(), new Date().toISOString());
    await refreshFeatures(asset);
  } catch (err) {
    logger.warn({ asset, err: errInfo(err) }, "on-demand ingest failed");
  }
};

const startScheduler = () => {
  if (newsTimer) return;
  runNewsIngest(); // warm immediately
  newsTimer = setInterval(runNewsIngest, NEWS_INTERVAL_MS);
  newsTimer.unref?.();
  logger.info({ intervalMs: NEWS_INTERVAL_MS }, "scheduler started");
};

const stopScheduler = () => {
  if (newsTimer) clearInterval(newsTimer);
  newsTimer = null;
};

module.exports = { startScheduler, stopScheduler, runNewsIngest, ingestNow, getLastIngestAt };
