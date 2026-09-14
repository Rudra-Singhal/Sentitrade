const { resolveAsset, mentionsAsset } = require("../services/assetService");

/**
 * Target-aware scoring (M3 roadmap: "NVDA soars as INTC stumbles should yield
 * opposite scores per ticker").
 *
 * There is no aspect-based-sentiment model in the stack — FinBERT and
 * twitter-roberta both score a whole string once. The practical version of
 * "target-aware" available without one: when a document mentions more than
 * one resolved asset, narrow the text sent to the model down to the
 * sentence(s) that actually mention the target, instead of scoring the whole
 * multi-asset document identically for every asset it touches.
 *
 * This is a real, measured improvement on genuinely multi-asset documents and
 * a no-op everywhere else — single-asset documents (the large majority of
 * what the connectors return) are returned unchanged, so this changes nothing
 * about their sentiment or their cache key.
 *
 * Known limitation, stated plainly: this splits on sentence boundaries, not
 * clauses. "NVDA soars as INTC stumbles" is one sentence and will not split —
 * it needs to read as two ("NVDA soars. INTC stumbles.") to window correctly.
 * A clause-level splitter would catch more cases but risks cutting a sentence
 * mid-thought for the models to misread; sentence-level is the boundary this
 * phase ships with.
 */

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'])|\n+/;

const splitSentences = (text) =>
  String(text || "")
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * @param {string} baseText  the text that would otherwise be scored whole
 * @param {string} targetSymbol  the asset this scoring pass is for
 * @param {number} entityCount  how many resolved assets the document mentions
 * @returns {string} the text to actually send for scoring
 */
const windowedText = (baseText, targetSymbol, entityCount) => {
  // Only one asset in play — the whole document is already "about" it.
  // Windowing has nothing to narrow and would only add risk.
  if (!targetSymbol || !entityCount || entityCount <= 1) return baseText;

  const asset = resolveAsset(targetSymbol);
  if (!asset) return baseText; // unresolvable symbol — score the whole text, same as before

  const sentences = splitSentences(baseText);
  if (sentences.length <= 1) return baseText; // nothing to narrow within

  const matching = sentences.filter((s) => mentionsAsset(s, asset));
  if (!matching.length) return baseText; // target not textually found — don't guess

  return matching.join(" ");
};

module.exports = { windowedText, splitSentences };
