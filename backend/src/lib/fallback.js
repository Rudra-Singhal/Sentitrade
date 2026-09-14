const { isProd } = require("../config/env");
const logger = require("../config/logger");
const metrics = require("./metrics");

/**
 * Single decision point for "we have no real data".
 *
 * - Outside production: return synthetic data (labelled `simulated` upstream)
 *   so local dev and demos still work offline.
 * - In production: refuse to fabricate. Return `null` and let the caller
 *   surface an explicit `unavailable` state. Increment a counter so a
 *   dashboard alert can fire — this should stay at zero in a healthy prod.
 *
 * @param {string} kind  short tag, e.g. "news" | "price" | "trend"
 * @param {() => any} makeSynthetic
 * @returns {any | null}
 */
const syntheticOrNull = (kind, makeSynthetic) => {
  if (isProd) {
    metrics.inc("simulated_data_suppressed_total");
    metrics.inc(`simulated_data_suppressed_total:${kind}`);
    logger.warn({ kind }, "synthetic data suppressed in production; returning unavailable");
    return null;
  }
  return makeSynthetic();
};

module.exports = { syntheticOrNull };
