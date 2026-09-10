const { createProviderClient } = require("../lib/httpClient");
const { env } = require("../config/env");
const { keywordsFor } = require("../services/assetService");
const logger = require("../config/logger");
const { errInfo } = logger;

const client = createProviderClient("reddit", { timeout: 9000, retries: 2 });

const SUBS = {
  crypto: "CryptoCurrency+Bitcoin+ethtrader+CryptoMarkets",
  stock: "stocks+wallstreetbets+investing+StockMarket"
};

const USER_AGENT = "sentitrade/2.0 (educational sentiment dashboard)";

let token = null;
let tokenExpiry = 0;

const getToken = async () => {
  if (token && Date.now() < tokenExpiry) return token;

  const basic = Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString(
    "base64"
  );
  const body = new URLSearchParams({
    grant_type: "password",
    username: env.REDDIT_USERNAME,
    password: env.REDDIT_PASSWORD
  });

  const res = await client.post("https://www.reddit.com/api/v1/access_token", body.toString(), {
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT
    }
  });

  token = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in - 120) * 1000;
  return token;
};

/** Pure: Reddit listing children -> connector docs. */
const mapListing = (children, sinceMs, limit) =>
  (Array.isArray(children) ? children : [])
    .map((c) => c.data)
    .filter((p) => p && p.title)
    .filter((p) => (p.created_utc ? p.created_utc * 1000 >= sinceMs : true))
    .slice(0, limit)
    .map((p) => ({
      text: `${p.title} ${String(p.selftext || "").slice(0, 500)}`.trim(),
      title: p.title,
      url: p.permalink ? `https://www.reddit.com${p.permalink}` : null,
      external_id: `reddit:${p.id}`,
      published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      author_handle: p.author || null,
      engagement: { upvotes: p.ups ?? null, comments: p.num_comments ?? null },
      provider_meta: {
        source_name: `reddit:${String(p.subreddit || "").toLowerCase()}`,
        awards: p.total_awards_received ?? 0,
        score: p.score ?? null
      }
    }));

/** @type {import("./types").SourceConnector} */
const redditConnector = {
  id: "reddit",
  sourceType: "forum",
  cadenceSeconds: 600,
  get enabled() {
    return Boolean(
      env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_USERNAME && env.REDDIT_PASSWORD
    );
  },
  appliesTo: (asset) => Boolean(SUBS[asset.type]),

  async fetch({ asset, since, limit = 25 }) {
    if (!this.enabled) return [];
    const sinceMs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
    const bearer = await getToken();

    const query = keywordsFor(asset).slice(0, 3).join(" OR ");
    const params = new URLSearchParams({
      q: query,
      restrict_sr: "1",
      sort: "new",
      t: "week",
      limit: String(Math.min(limit, 50))
    });

    const res = await client.get(
      `https://oauth.reddit.com/r/${SUBS[asset.type]}/search?${params.toString()}`,
      { headers: { Authorization: `Bearer ${bearer}`, "User-Agent": USER_AGENT } }
    );
    return mapListing(res.data?.data?.children, sinceMs, limit);
  },

  async healthcheck() {
    if (!this.enabled) return { ok: false, detail: "reddit credentials not configured" };
    try {
      await getToken();
      return { ok: true };
    } catch (err) {
      logger.warn({ err: errInfo(err) }, "reddit healthcheck failed");
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = redditConnector;
module.exports.mapListing = mapListing;
