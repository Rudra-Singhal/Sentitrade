const { analyzeHeadline } = require("../services/sentimentService");
const sentimentClient = require("../services/sentimentClient");

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

/** Synchronous single-document scoring (in-process only). */
const scoreDocument = (normDoc) => ({
  ...normDoc,
  sentiment: nativeSentiment(normDoc) || fallbackSentiment(normDoc)
});

/**
 * Score a batch, preferring the sentiment service.
 *
 * Documents carrying a platform-native label skip the model entirely. The rest
 * go to the service in one round trip; anything it does not return a usable
 * score for falls back to VADER. Never throws.
 */
const scoreDocuments = async (docs = []) => {
  if (!docs.length) return [];

  const native = new Map();
  const toScore = [];

  docs.forEach((doc, index) => {
    const platform = nativeSentiment(doc);
    if (platform) {
      native.set(index, platform);
      return;
    }
    toScore.push({
      index,
      id: String(index),
      text: doc.title || doc.text || "",
      source_type: doc.source_type || "news",
      target: doc.asset
    });
  });

  let scored = new Map();
  if (toScore.length && sentimentClient.isConfigured()) {
    scored = await sentimentClient.scoreBatch(toScore.filter((item) => item.text));
  }

  return docs.map((doc, index) => {
    const platform = native.get(index);
    if (platform) return { ...doc, sentiment: platform };

    const fromService = scored.get(String(index));
    if (fromService) {
      return {
        ...doc,
        sentiment: {
          score: fromService.score,
          label: fromService.label,
          confidence: fromService.confidence,
          model: fromService.model,
          model_version: fromService.model_version,
          scored_at: new Date()
        }
      };
    }

    return { ...doc, sentiment: fallbackSentiment(doc) };
  });
};

module.exports = { scoreDocument, scoreDocuments, MODEL, MODEL_VERSION };
