const { normalizeAsset } = require("../services/assetService");
const { enabledConnectors } = require("../connectors");
const { normalize } = require("./normalize");
const { scoreDocument } = require("./score");
const { flagNearDuplicates } = require("./dedupeNearby");
const { persist } = require("./persist");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");

/**
 * Fetch -> normalize -> score -> persist for one asset across every enabled
 * connector of the requested source types. Safe to call on a schedule or
 * (for now) on demand from a read. Never throws — per-connector failures are
 * isolated and reported.
 *
 * @returns {{ asset, connectors: string[], perSource: object, new: number, fetchedAny: boolean }}
 */
const ingestAsset = async (assetInput, { limit = 25, types = ["news"], connectors } = {}) => {
  const asset = normalizeAsset(assetInput);
  const selected = (connectors || enabledConnectors(types)).filter(
    (c) => typeof c.appliesTo !== "function" || c.appliesTo(asset)
  );
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const perSource = {};
  let newCount = 0;
  let fetchedAny = false;

  for (const connector of selected) {
    try {
      const raw = await connector.fetch({ asset, since, limit });
      const docs = raw
        .map((d) => normalize(connector, asset.symbol, d))
        .filter(Boolean)
        .map(scoreDocument);

      const duplicates = await flagNearDuplicates(asset.symbol, docs);
      const lowRelevance = docs.filter((d) => (d.relevance ?? 1) < 0.35).length;
      const { upserted } = await persist(docs);
      perSource[connector.id] = {
        fetched: raw.length,
        normalized: docs.length,
        low_relevance: lowRelevance,
        near_duplicate: duplicates,
        new: upserted
      };
      newCount += upserted;
      if (lowRelevance) metrics.inc(`ingest_low_relevance_total:${connector.id}`, lowRelevance);
      if (duplicates) metrics.inc(`ingest_near_duplicate_total:${connector.id}`, duplicates);
      if (raw.length > 0) fetchedAny = true;

      metrics.inc(`ingest_docs_total:${connector.id}:ok`, docs.length);
      metrics.markTimestamp(`last_ingest_ok_at:${connector.id}`);
    } catch (err) {
      perSource[connector.id] = { error: errInfo(err).message };
      metrics.inc(`ingest_errors_total:${connector.id}`);
      logger.warn(
        { connector: connector.id, asset: asset.symbol, err: errInfo(err) },
        "connector ingest failed"
      );
    }
  }

  return {
    asset: asset.symbol,
    connectors: selected.map((c) => c.id),
    perSource,
    new: newCount,
    fetchedAny
  };
};

module.exports = { ingestAsset };
