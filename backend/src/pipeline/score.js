const { analyzeHeadline } = require("../services/sentimentService");

// M1: VADER inline. M3 swaps this for a FinBERT/social model service with a
// content-hash cache; the `model` / `model_version` fields make that migration
// reproducible and let old scores be re-computed.
const MODEL = "vader";
let MODEL_VERSION = "unknown";
try {
  MODEL_VERSION = require("vader-sentiment/package.json").version;
} catch {
  /* keep default */
}

const scoreDocument = (normDoc) => {
  const result = analyzeHeadline(normDoc.title || normDoc.text);
  return {
    ...normDoc,
    sentiment: {
      score: result.sentiment_score,
      label: result.sentiment_label,
      model: MODEL,
      model_version: MODEL_VERSION,
      scored_at: new Date()
    }
  };
};

module.exports = { scoreDocument, MODEL, MODEL_VERSION };
