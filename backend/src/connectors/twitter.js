const { createProviderClient } = require("../lib/httpClient");
const { env } = require("../config/env");
const { keywordsFor } = require("../services/assetService");
const logger = require("../config/logger");
const { errInfo } = logger;

// X / Twitter. Not on by default — the official API's recent-search needs a
// paid tier ($200/mo Basic). Supports either:
//   TWITTER_BEARER_TOKEN  -> official API v2 recent search
//   TWITTERAPI_IO_KEY     -> twitterapi.io reseller (cheaper, third-party ToS)
const client = createProviderClient("twitter", { timeout: 9000, retries: 1 });

const mode = () => {
  if (env.TWITTERAPI_IO_KEY) return "twitterapi_io";
  if (env.TWITTER_BEARER_TOKEN) return "official";
  return null;
};

const buildQuery = (asset) => {
  const cashtag = `$${asset.symbol}`;
  const name = keywordsFor(asset).find((t) => t.length > 3 && t !== asset.symbol.toLowerCase());
  const base = name ? `(${cashtag} OR "${name}")` : cashtag;
  return `${base} lang:en -is:retweet`;
};

/** Pure: official API v2 payload -> connector docs. */
const mapOfficial = (payload, limit) => {
  const users = Object.fromEntries((payload?.includes?.users || []).map((u) => [u.id, u]));
  return (payload?.data || []).slice(0, limit).map((t) => {
    const u = users[t.author_id] || {};
    const ageDays = u.created_at
      ? Math.round((Date.now() - new Date(u.created_at).getTime()) / 86400000)
      : null;
    return {
      text: t.text,
      title: "",
      url: u.username ? `https://x.com/${u.username}/status/${t.id}` : null,
      external_id: `twitter:${t.id}`,
      published_at: t.created_at || null,
      author_handle: u.username || null,
      author_followers: u.public_metrics?.followers_count ?? null,
      author_account_age_days: ageDays,
      engagement: {
        likes: t.public_metrics?.like_count ?? null,
        shares: t.public_metrics?.retweet_count ?? null,
        comments: t.public_metrics?.reply_count ?? null
      },
      provider_meta: { source_name: "twitter" }
    };
  });
};

/** Pure: twitterapi.io payload -> connector docs. */
const mapTwitterApiIo = (payload, limit) =>
  (payload?.tweets || payload?.data || []).slice(0, limit).map((t) => ({
    text: t.text || t.full_text || "",
    title: "",
    url: t.url || (t.author?.userName ? `https://x.com/${t.author.userName}/status/${t.id}` : null),
    external_id: `twitter:${t.id}`,
    published_at: t.createdAt || t.created_at || null,
    author_handle: t.author?.userName || t.author?.screen_name || null,
    author_followers: t.author?.followers ?? t.author?.followers_count ?? null,
    engagement: {
      likes: t.likeCount ?? t.favorite_count ?? null,
      shares: t.retweetCount ?? t.retweet_count ?? null,
      comments: t.replyCount ?? null
    },
    provider_meta: { source_name: "twitter" }
  }));

/** @type {import("./types").SourceConnector} */
const twitterConnector = {
  id: "twitter",
  sourceType: "social",
  cadenceSeconds: 300,
  get enabled() {
    return mode() !== null;
  },

  async fetch({ asset, limit = 25 }) {
    const m = mode();
    if (!m) return [];
    const query = buildQuery(asset);

    if (m === "official") {
      const params = new URLSearchParams({
        query,
        max_results: String(Math.max(10, Math.min(limit, 100))),
        "tweet.fields": "created_at,public_metrics,lang",
        expansions: "author_id",
        "user.fields": "public_metrics,created_at,username"
      });
      const res = await client.get(
        `https://api.twitter.com/2/tweets/search/recent?${params.toString()}`,
        { headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` } }
      );
      return mapOfficial(res.data, limit);
    }

    // twitterapi.io
    const params = new URLSearchParams({ query, queryType: "Latest" });
    const res = await client.get(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`,
      { headers: { "X-API-Key": env.TWITTERAPI_IO_KEY } }
    );
    return mapTwitterApiIo(res.data, limit);
  },

  async healthcheck() {
    if (!mode()) return { ok: false, detail: "no twitter credentials configured" };
    try {
      await this.fetch({
        asset: { symbol: "AAPL", displayName: "Apple", aliases: ["apple"] },
        limit: 10
      });
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "twitter healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = twitterConnector;
module.exports.mapOfficial = mapOfficial;
module.exports.mapTwitterApiIo = mapTwitterApiIo;
module.exports.buildQuery = buildQuery;
