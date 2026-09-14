const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

/**
 * Heuristic author/content quality for social & forum posts (0..1).
 * Cheap signals only — a proper bot classifier is out of scope. Low scores
 * are down-weighted / filtered from social aggregation, not deleted.
 */
const authorQuality = ({ author = {}, text = "" } = {}) => {
  let q = 1;

  if (typeof author.account_age_days === "number") {
    if (author.account_age_days < 7) q -= 0.5;
    else if (author.account_age_days < 30) q -= 0.2;
  }
  if (typeof author.followers === "number" && author.followers < 5) q -= 0.15;

  const body = String(text);
  const withoutLinks = body.replace(/https?:\/\/\S+/g, "").trim();
  const linkCount = (body.match(/https?:\/\//g) || []).length;
  if (linkCount >= 1 && withoutLinks.length < 40) q -= 0.5; // link drop, ~no text
  if (linkCount >= 3) q -= 0.3;

  const emoji = (body.match(EMOJI_RE) || []).length;
  if (body.length > 0 && emoji / body.length > 0.12) q -= 0.3;

  const hashtags = (body.match(/#\w+/g) || []).length;
  if (hashtags >= 5) q -= 0.3;

  return Number(Math.max(0, Math.min(1, q)).toFixed(2));
};

module.exports = { authorQuality };
