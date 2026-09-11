const RssParser = require("rss-parser");
const { mentionsAsset } = require("../services/assetService");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");

const parser = new RssParser({ timeout: 9000 });

// Zero-quota baseline. Grouped by market — US equities have poor per-ticker
// RSS so they stay on NewsAPI + Finnhub + GDELT.
const FEEDS = {
  crypto: [
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", name: "CoinDesk" },
    { url: "https://cointelegraph.com/rss", name: "Cointelegraph" },
    { url: "https://decrypt.co/feed", name: "Decrypt" },
    { url: "https://www.theblock.co/rss.xml", name: "The Block" }
  ],
  india: [
    {
      url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      name: "Economic Times"
    },
    { url: "https://www.moneycontrol.com/rss/business.xml", name: "Moneycontrol" },
    { url: "https://www.livemint.com/rss/markets", name: "LiveMint" },
    { url: "https://www.business-standard.com/rss/markets-106.rss", name: "Business Standard" }
  ]
};

const feedGroup = (asset) => {
  if (asset.type === "crypto") return "crypto";
  if (asset.exchange === "NSE") return "india";
  return null;
};

/** Pure: parsed feed items -> connector docs, filtered by asset mention + window. */
const selectItems = (feeds, asset, sinceMs, limit = 30) => {
  const out = [];
  for (const { feed, items } of feeds) {
    for (const item of items || []) {
      const title = item.title || "";
      const published = item.isoDate || item.pubDate;
      const publishedMs = published ? new Date(published).getTime() : Date.now();
      if (Number.isFinite(publishedMs) && publishedMs < sinceMs) continue;
      if (!mentionsAsset(`${title} ${item.contentSnippet || ""}`, asset)) continue;

      out.push({
        text: title,
        title,
        url: item.link || null,
        external_id: item.guid || item.link || null,
        published_at: published || null,
        provider_meta: { source_name: feed.name, feed_url: feed.url }
      });
    }
  }
  return out.slice(0, limit);
};

/** @type {import("./types").SourceConnector} */
const rssConnector = {
  id: "rss",
  sourceType: "news",
  cadenceSeconds: 600,
  enabled: true,
  appliesTo: (asset) => Boolean(feedGroup(asset)),

  async fetch({ asset, since, limit = 30 }) {
    const feeds = FEEDS[feedGroup(asset)] || [];
    const sinceMs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;

    const settled = await Promise.allSettled(feeds.map((f) => parser.parseURL(f.url)));
    const parsed = [];
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        parsed.push({ feed: feeds[i], items: result.value.items || [] });
      } else {
        metrics.inc(`rss_feed_errors_total:${feeds[i].name}`);
        logger.warn({ feed: feeds[i].name, err: errInfo(result.reason) }, "rss feed failed");
      }
    });

    return selectItems(parsed, asset, sinceMs, limit);
  },

  async healthcheck() {
    try {
      await parser.parseURL(FEEDS.crypto[0].url);
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: errInfo(err).message };
    }
  }
};

module.exports = rssConnector;
module.exports.FEEDS = FEEDS;
module.exports.selectItems = selectItems;
module.exports.feedGroup = feedGroup;
