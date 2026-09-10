const { GAZETTEER } = require("./gazetteer");

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Precompile one matcher per asset: a cashtag pattern and a word-boundary
// pattern over its terms. ~20 assets x ~10 terms — naive per-asset scan is fine.
const MATCHERS = Object.fromEntries(
  Object.values(GAZETTEER).map((g) => [
    g.symbol,
    {
      ...g,
      cashtagRe: new RegExp(`(^|[^a-z0-9])\\${g.cashtag}([^a-z0-9]|$)`, "i"),
      termRe: new RegExp(`(^|[^a-z0-9_])(${g.terms.map(escape).join("|")})([^a-z0-9_]|$)`, "gi"),
      strongRe: g.strongTerms.length
        ? new RegExp(`(^|[^a-z0-9_])(${g.strongTerms.map(escape).join("|")})([^a-z0-9_]|$)`, "i")
        : null
    }
  ])
);

const countMatches = (re, text) => {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) n += 1;
  return n;
};

/**
 * Resolve which assets a document is about.
 *
 * @param {{ title?: string, text: string }} doc
 * @returns {{ entities: {symbol,name,mentions,salience,cashtag:boolean}[], primaryRelevance: number }}
 *   where `primaryAsset` (the asset the connector queried for) drives relevance.
 */
const resolveEntities = (doc, primaryAsset) => {
  const title = String(doc.title || "").toLowerCase();
  const body = `${title} ${String(doc.text || "").toLowerCase()}`;
  const primary = String(primaryAsset || "").toUpperCase();

  const entities = [];
  for (const m of Object.values(MATCHERS)) {
    const cashtag = m.cashtagRe.test(body);
    const mentions = countMatches(m.termRe, body);
    const strong = m.strongRe ? m.strongRe.test(body) : false;
    const inTitle = m.strongRe ? m.strongRe.test(title) : false;

    if (!cashtag && mentions === 0) continue;
    // Ambiguous tickers need a cashtag or a real name/alias hit, not a bare match.
    if (m.ambiguous && !cashtag && !strong) continue;

    // Title mentions and cashtags dominate; a lone passing mention in the body
    // stays below the read/aggregation threshold.
    const salience = Math.min(
      1,
      0.2 + (inTitle ? 0.35 : 0) + (cashtag ? 0.4 : 0) + 0.1 * Math.min(mentions, 3)
    );

    entities.push({
      symbol: m.symbol,
      name: m.name,
      mentions,
      salience: Number(salience.toFixed(2)),
      cashtag
    });
  }

  entities.sort((a, b) => b.salience - a.salience);

  const primaryEntity = entities.find((e) => e.symbol === primary);
  let primaryRelevance;
  if (!primaryEntity) {
    primaryRelevance = 0.2; // came from a query for this asset but the text doesn't mention it
  } else {
    const others = entities.filter(
      (e) => e.symbol !== primary && e.salience >= primaryEntity.salience
    );
    primaryRelevance = Math.max(0.2, primaryEntity.salience - 0.15 * others.length);
  }

  return { entities, primaryRelevance: Number(primaryRelevance.toFixed(2)) };
};

module.exports = { resolveEntities, MATCHERS };
