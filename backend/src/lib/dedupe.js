const crypto = require("crypto");

/**
 * Normalize a headline/text for dedupe comparison:
 * lowercase, strip a trailing " - Source" / " | Source" attribution,
 * drop punctuation, collapse whitespace.
 */
const normalizeText = (input = "") =>
  String(input)
    .toLowerCase()
    .replace(/\s+[-|–—]\s+[^-|–—]{1,40}$/u, "") // trailing " - Reuters"
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Stable dedupe key. Scoped by asset so the same wire story about two
 * different tickers is kept once per ticker.
 */
const dedupeKey = (asset, text) =>
  crypto
    .createHash("sha1")
    .update(`${String(asset).toUpperCase()}::${normalizeText(text)}`)
    .digest("hex");

module.exports = { normalizeText, dedupeKey };
