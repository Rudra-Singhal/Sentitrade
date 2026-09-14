const { analyzeHeadline } = require("../services/sentimentService");
const { normalizeAsset } = require("../services/assetService");
const sentimentClient = require("../services/sentimentClient");
const sentimentCache = require("./sentimentCache");
const metrics = require("../lib/metrics");

// The in-process fallback, unchanged since M1. From M3 it is the *fallback*:
// the preferred scorer is the Python service (`sentiment-service/`), which
// routes documents to a finance or social transformer. The `model` /
// `model_version` fields on every document record which one actually ran, so a
// mixed-provenance store stays auditable and re-scorable.
const MODEL = "vader";
let MODEL_VERSION = "unknown";
try {
  MODEL_VERSION = require("vader-sentiment/package.json").version;
} catch {
  /* keep default */
}

const NATIVE = { Bullish: 0.5, Bearish: -0.5 };

/** The platform already told us the author's stance — trust it over any model. */
const nativeSentiment = (normDoc) => {
  const native = normDoc.provider_meta?.native_sentiment;
  if (!native || !(native in NATIVE)) return null;
  const score = NATIVE[native];
  return {
    score,
    label: score > 0 ? "positive" : "negative",
    model: "platform_native",
    model_version: normDoc.source,
    scored_at: new Date()
  };
};

const fallbackSentiment = (normDoc) => {
  const result = analyzeHeadline(normDoc.title || normDoc.text);
  return {
    score: result.sentiment_score,
    label: result.sentiment_label,
    model: MODEL,
    model_version: MODEL_VERSION,
    scored_at: new Date()
  };
};

/** Synchronous single-document scoring (in-process only, never touches the cache). */
const scoreDocument = (normDoc) => ({
  ...normDoc,
  sentiment: nativeSentiment(normDoc) || fallbackSentiment(normDoc)
});

const toSentimentFields = (cached) => ({
  score: cached.score,
  label: cached.label,
  confidence: cached.confidence,
  model: cached.model,
  model_version: cached.model_version,
  scored_at: new Date()
});

/**
 * Score a batch, preferring — in order — a platform-native label, a
 * content-hash cache hit, then the sentiment service, then VADER.
 *
 * Only genuine service results are cached (never a VADER fallback caused by
 * the service being unreachable or a routed model failing) — see
 * pipeline/sentimentCache.js. A cache hit therefore always means "this exact
 * text, scored by the model that was supposed to score it". Never throws.
 */
const scoreDocuments = async (docs = []) => {
  if (!docs.length) return [];

  const native = new Map();
  const candidates = []; // { index, id, text, source_type, asset_class, target, key }

  docs.forEach((doc, index) => {
    const platform = nativeSentiment(doc);
    if (platform) {
      native.set(index, platform);
      return;
    }
    const text = doc.title || doc.text || "";
    if (!text) return; // falls through to fallbackSentiment below

    const sourceType = doc.source_type || "news";
    // `primary_asset` is what normalize() writes — NOT `asset`. Reading the
    // wrong field here silently routed every document to the crypto model,
    // because normalizeAsset() defaults an unknown symbol to BTC.
    const assetClass = normalizeAsset(doc.primary_asset).type === "crypto" ? "crypto" : "equity";

    candidates.push({
      index,
      id: String(index),
      text,
      source_type: sourceType,
      asset_class: assetClass,
      target: doc.primary_asset,
      key: sentimentCache.cacheKey(text, sourceType, assetClass)
    });
  });

  const byIndex = new Map(candidates.map((c) => [c.index, c])); // O(1) lookup below, not a scan per doc
  const cacheHits = await sentimentCache.getMany(candidates.map((c) => c.key));
  const toScore = candidates.filter((c) => !cacheHits.has(c.key));

  metrics.inc("sentiment_cache_hit_total", candidates.length - toScore.length);
  metrics.inc("sentiment_cache_miss_total", toScore.length);

  let scored = new Map();
  if (toScore.length && sentimentClient.isConfigured()) {
    scored = await sentimentClient.scoreBatch(toScore);
  }

  // Write only real, non-degraded model results back — a fallback caused by a
  // transient outage must not calcify into a permanent wrong answer for text
  // the real model never actually saw.
  const toCache = [];
  for (const candidate of toScore) {
    const result = scored.get(candidate.id);
    if (result && !result.degraded) {
      toCache.push({
        key: candidate.key,
        score: result.score,
        label: result.label,
        confidence: result.confidence,
        model: result.model,
        model_version: result.model_version
      });
    }
  }
  await sentimentCache.setMany(toCache);

  return docs.map((doc, index) => {
    const platform = native.get(index);
    if (platform) return { ...doc, sentiment: platform };

    const candidate = byIndex.get(index);
    if (!candidate) return { ...doc, sentiment: fallbackSentiment(doc) };

    const cached = cacheHits.get(candidate.key);
    if (cached) return { ...doc, sentiment: toSentimentFields(cached) };

    const fromService = scored.get(candidate.id);
    if (fromService) return { ...doc, sentiment: toSentimentFields(fromService) };

    return { ...doc, sentiment: fallbackSentiment(doc) };
  });
};

module.exports = { scoreDocument, scoreDocuments, MODEL, MODEL_VERSION };
