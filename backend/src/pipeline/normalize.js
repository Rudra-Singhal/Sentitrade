const { dedupeKey } = require("../lib/dedupe");
const { resolveEntities } = require("./entities");
const { weightForSource } = require("../config/sources");

/** Reject absurd timestamps; default missing/invalid to now. */
const clampPublishedAt = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date();
  const now = Date.now();
  if (d.getTime() > now + 60 * 60 * 1000) return new Date(); // > 1h in the future
  if (d.getTime() < now - 365 * 24 * 60 * 60 * 1000) return new Date(now); // > 1y old
  return d;
};

/**
 * Connector output -> canonical (pre-sentiment) RawDocument shape.
 * Returns null for documents with no usable text.
 *
 * @param {import("../connectors/types").SourceConnector} connector
 * @param {string} assetSymbol
 * @param {import("../connectors/types").ConnectorDoc} doc
 */
const normalize = (connector, assetSymbol, doc) => {
  const text = String(doc.text || "").trim();
  if (!text) return null;

  const symbol = String(assetSymbol).toUpperCase();
  const title = doc.title || "";

  // Trust the connector's own entity/sentiment hints when present (StockTwits
  // cashtags, provider ticker tags); otherwise resolve from the text.
  const { entities, primaryRelevance } = resolveEntities({ title, text }, symbol);
  const resolvedSymbols = Array.from(new Set([symbol, ...entities.map((e) => e.symbol)]));

  return {
    source: connector.id,
    source_type: connector.sourceType,
    external_id: doc.external_id || null,
    dedupe_key: dedupeKey(symbol, title || text),
    url: doc.url || null,
    author: {
      handle: doc.author_handle || null,
      followers: doc.author_followers ?? null,
      account_age_days: doc.author_account_age_days ?? null
    },
    title,
    text,
    lang: doc.lang || "en",
    published_at: clampPublishedAt(doc.published_at),
    ingested_at: new Date(),
    primary_asset: symbol,
    assets: resolvedSymbols,
    entities,
    relevance: doc.relevance ?? primaryRelevance,
    source_weight: weightForSource(doc.provider_meta?.source_name || connector.id),
    engagement: {
      likes: doc.engagement?.likes ?? null,
      shares: doc.engagement?.shares ?? null,
      comments: doc.engagement?.comments ?? null,
      upvotes: doc.engagement?.upvotes ?? null,
      views: doc.engagement?.views ?? null
    },
    provider_meta: {
      ...(doc.provider_meta || {}),
      ...(doc.native_sentiment ? { native_sentiment: doc.native_sentiment } : {})
    }
  };
};

module.exports = { normalize, clampPublishedAt };
