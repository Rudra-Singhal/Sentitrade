const { createProviderClient } = require("../lib/httpClient");
const { keywordsFor } = require("../services/assetService");
const logger = require("../config/logger");
const { errInfo } = logger;

// GDELT DOC 2.0 — free, no key, global news (covers US + Indian english sources
// well). Aggressively rate-limited (~1 req / 5s), so self-throttle and give it
// a long timeout.
const client = createProviderClient("gdelt", { timeout: 20000, retries: 1 });

const MIN_GAP_MS = 6000;
let lastCall = 0;
const throttle = async () => {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
};

const buildQuery = (asset) => {
  const terms = keywordsFor(asset)
    .filter((t) => t.length > 2 && t !== asset.symbol.toLowerCase())
    .slice(0, 3)
    .map((t) => `"${t}"`);
  const name = terms.length ? terms.join(" OR ") : `"${asset.displayName}"`;
  return `(${name}) sourcelang:english`;
};

/** Pure: GDELT artlist -> connector docs. */
const mapArticles = (articles, sinceMs, limit) =>
  (Array.isArray(articles) ? articles : [])
    .filter((a) => a.title)
    .map((a) => {
      // seendate: "20260910T121500Z"
      const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate || "");
      const publishedIso = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
      return {
        text: a.title,
        title: a.title,
        url: a.url || null,
        external_id: a.url || null,
        published_at: publishedIso,
        publishedMs: publishedIso ? new Date(publishedIso).getTime() : Date.now(),
        provider_meta: { source_name: a.domain || "GDELT", country: a.sourcecountry || null }
      };
    })
    .filter((d) => !Number.isFinite(d.publishedMs) || d.publishedMs >= sinceMs)
    .slice(0, limit)
    .map(({ publishedMs, ...doc }) => doc); // eslint-disable-line no-unused-vars

/** @type {import("./types").SourceConnector} */
const gdeltConnector = {
  id: "gdelt",
  sourceType: "news",
  cadenceSeconds: 900,
  enabled: true,

  async fetch({ asset, since, limit = 25 }) {
    const sinceMs = since ? new Date(since).getTime() : Date.now() - 3 * 24 * 60 * 60 * 1000;
    const params = new URLSearchParams({
      query: buildQuery(asset),
      mode: "artlist",
      maxrecords: String(Math.min(limit, 50)),
      timespan: "2d",
      format: "json"
    });
    await throttle();
    const res = await client.get(
      `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`
    );
    return mapArticles(res.data?.articles, sinceMs, limit);
  },

  async healthcheck() {
    try {
      await client.get(
        "https://api.gdeltproject.org/api/v2/doc/doc?query=markets&mode=artlist&maxrecords=1&format=json"
      );
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "gdelt healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = gdeltConnector;
module.exports.mapArticles = mapArticles;
module.exports.buildQuery = buildQuery;
