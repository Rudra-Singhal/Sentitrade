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
 * Fetch -> normalize -> score -> dedup -> persist for one asset across every
 * enabled connector of the requested source types. Safe to call on a schedule
 * or on demand from a socket. Never throws — per-connector failures are
 * isolated and reported.
 *
 * Connectors are fetched in parallel (they're independent network calls —
 * one slow/rate-limited provider, e.g. GDELT, must not block the others).
 * Near-duplicate detection then runs once over the combined, time-ordered
 * batch so the same story returned by two connectors in one cycle is still
 * only counted once, before each connector's docs are persisted.
 *
 * @returns {{ asset, connectors: string[], perSource: object, new: number, fetchedAny: boolean }}
 */
const ingestAsset = async (assetInput, { limit = 25, types = ["news"], connectors } = {}) => {
  const asset = normalizeAsset(assetInput);
  const selected = (connectors || enabledConnectors(types)).filter(
    (c) => typeof c.appliesTo !== "function" || c.appliesTo(asset)
  );
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const fetched = await Promise.allSettled(
    selected.map((connector) => connector.fetch({ asset, since, limit }))
  );

  const perConnectorDocs = new Map(); // connector.id -> normalized+scored docs
  const perSource = {};
  let fetchedAny = false;

  selected.forEach((connector, i) => {
    const result = fetched[i];
    if (result.status === "rejected") {
      perSource[connector.id] = { error: errInfo(result.reason).message };
      metrics.inc(`ingest_errors_total:${connector.id}`);
      logger.warn(
        { connector: connector.id, asset: asset.symbol, err: errInfo(result.reason) },
        "connector ingest failed"
      );
      return;
    }

    const raw = result.value || [];
    if (raw.length > 0) fetchedAny = true;
    const docs = raw
      .map((d) => normalize(connector, asset.symbol, d))
      .filter(Boolean)
      .map(scoreDocument);

    perConnectorDocs.set(connector.id, docs);
    perSource[connector.id] = { fetched: raw.length, normalized: docs.length };
  });

  // Dedup once across the whole batch, oldest first, so `cluster_id` always
  // points at the earliest-published copy regardless of connector order.
  const combined = Array.from(perConnectorDocs.values())
    .flat()
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
  await flagNearDuplicates(asset.symbol, combined);

  let newCount = 0;
  for (const [connectorId, docs] of perConnectorDocs) {
    const lowRelevance = docs.filter((d) => (d.relevance ?? 1) < 0.35).length;
    const duplicates = docs.filter((d) => d.is_duplicate).length;
    const { upserted } = await persist(docs);

    perSource[connectorId] = {
      ...perSource[connectorId],
      low_relevance: lowRelevance,
      near_duplicate: duplicates,
      new: upserted
    };
    newCount += upserted;
    if (lowRelevance) metrics.inc(`ingest_low_relevance_total:${connectorId}`, lowRelevance);
    if (duplicates) metrics.inc(`ingest_near_duplicate_total:${connectorId}`, duplicates);
    metrics.inc(`ingest_docs_total:${connectorId}:ok`, docs.length);
    metrics.markTimestamp(`last_ingest_ok_at:${connectorId}`);
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
