const { env } = require("../config/env");
const { createProviderClient } = require("../lib/httpClient");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");

/**
 * Client for the Python sentiment service (`sentiment-service/`).
 *
 * The service is an enhancement, never a dependency: if `SENTIMENT_SERVICE_URL`
 * is unset, or the service is down, slow, or broken, scoring silently falls
 * back to the in-process VADER scorer that has run since M1. A sentiment
 * provider outage must degrade score quality, not stop ingestion.
 *
 * A short-circuit breaker keeps a dead service from adding its timeout to
 * every batch: after `FAILURE_THRESHOLD` consecutive failures the client stops
 * calling for `COOLDOWN_MS` and goes straight to the fallback.
 */

const BATCH_SIZE = 64; // must stay <= the service's MAX_BATCH
const TIMEOUT_MS = 4000;
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

const baseUrl = (env.SENTIMENT_SERVICE_URL || "").replace(/\/$/, "");
const client = baseUrl
  ? createProviderClient("sentiment", { timeout: TIMEOUT_MS, retries: 0 })
  : null;

let consecutiveFailures = 0;
let openedAt = 0;

const isConfigured = () => Boolean(baseUrl);

/** Open = we are skipping the service and using the fallback. */
const breakerOpen = () => {
  if (consecutiveFailures < FAILURE_THRESHOLD) return false;
  if (Date.now() - openedAt < COOLDOWN_MS) return true;
  // Cooldown elapsed — allow one probe through.
  consecutiveFailures = 0;
  return false;
};

const recordFailure = () => {
  consecutiveFailures += 1;
  if (consecutiveFailures === FAILURE_THRESHOLD) {
    openedAt = Date.now();
    logger.warn(
      { failures: consecutiveFailures, cooldownMs: COOLDOWN_MS },
      "sentiment service breaker opened — falling back to in-process scorer"
    );
  }
};

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Pure: service response rows -> Map(id -> scored fields). Exported for tests.
 * Rows that are malformed are dropped rather than trusted — a bad row would
 * otherwise write a garbage score onto a document.
 */
const mapResults = (results) => {
  const byId = new Map();
  for (const row of Array.isArray(results) ? results : []) {
    if (!row || typeof row.id !== "string") continue;
    const score = Number(row.score);
    if (!Number.isFinite(score) || score < -1 || score > 1) continue;
    if (!["positive", "negative", "neutral"].includes(row.label)) continue;

    byId.set(row.id, {
      score: Number(score.toFixed(4)),
      label: row.label,
      confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
      model: String(row.model || "unknown"),
      model_version: String(row.model_version || "unknown"),
      degraded: Boolean(row.degraded)
    });
  }
  return byId;
};

/**
 * Score documents through the service.
 *
 * @param {{id: string, text: string, source_type: string, target?: string}[]} items
 * @returns {Promise<Map<string, object>>} id -> scored fields. Ids missing from
 *   the map were not scored and must be handled by the caller's fallback —
 *   this never throws and never invents a score.
 */
const scoreBatch = async (items) => {
  if (!isConfigured() || !items.length) return new Map();

  if (breakerOpen()) {
    metrics.inc("sentiment_service_skipped_total", items.length);
    return new Map();
  }

  const scored = new Map();

  for (const batch of chunk(items, BATCH_SIZE)) {
    try {
      const res = await client.post(`${baseUrl}/score`, {
        items: batch.map((item) => ({
          id: item.id,
          text: item.text,
          source_type: item.source_type || "news",
          // Routing depends on this: crypto news goes to a different model
          // than equity news, because FinBERT misreads crypto flow language.
          asset_class: item.asset_class === "crypto" ? "crypto" : "equity",
          ...(item.target ? { target: item.target } : {})
        }))
      });

      for (const [id, value] of mapResults(res.data?.results)) scored.set(id, value);

      consecutiveFailures = 0;
      metrics.inc("sentiment_service_scored_total", batch.length);
    } catch (err) {
      recordFailure();
      metrics.inc("sentiment_service_errors_total");
      logger.warn(
        { err: errInfo(err), batch: batch.length },
        "sentiment service batch failed — falling back for these documents"
      );
      // Keep going: a later batch may succeed, and anything unscored falls back.
    }
  }

  return scored;
};

const healthcheck = async () => {
  if (!isConfigured()) return { ok: false, detail: "SENTIMENT_SERVICE_URL not set" };
  try {
    const res = await client.get(`${baseUrl}/health`);
    return { ok: true, status: res.data?.status, models: res.data?.models };
  } catch (err) {
    return { ok: false, detail: errInfo(err).message };
  }
};

/** Test-only: reset breaker state between cases. */
const _resetBreaker = () => {
  consecutiveFailures = 0;
  openedAt = 0;
};

module.exports = {
  scoreBatch,
  healthcheck,
  isConfigured,
  mapResults,
  BATCH_SIZE,
  _resetBreaker
};
