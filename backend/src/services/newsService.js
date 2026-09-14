const mongoose = require("mongoose");
const RawDocument = require("../models/RawDocument");
const { normalizeAsset } = require("./assetService");
const { averageSentiment } = require("./sentimentService");
const { makeMockNews, makeMockTrend } = require("./mockDataService");
const { syntheticOrNull } = require("../lib/fallback");
const { DATA_SOURCE } = require("../lib/dataSource");

// Off-topic (relevance < 0.35) and near-duplicate documents stay in the store
// but are excluded from the sentiment read and the trend. `$not $lt` also
// matches pre-M2 documents that have no relevance score.
const RELEVANCE_MIN = 0.35;
const qualityFilter = {
  relevance: { $not: { $lt: RELEVANCE_MIN } },
  is_duplicate: { $ne: true }
};

const isMongoReady = () => mongoose.connection.readyState === 1;

const toMinutes = (range = "1h") => {
  const normalized = String(range).toLowerCase();
  if (normalized === "5m") return 5;
  if (normalized === "24h") return 1440;
  return 60;
};

const newestTimestamp = (items = []) => {
  let newest = null;
  for (const item of items) {
    const ts = item.timestamp ? new Date(item.timestamp).getTime() : NaN;
    if (!Number.isNaN(ts) && (newest === null || ts > newest)) newest = ts;
  }
  return newest === null ? null : new Date(newest).toISOString();
};

/** RawDocument -> the flat item shape the API/frontend already expects. */
const toItem = (doc) => ({
  _id: String(doc._id),
  text: doc.title || doc.text,
  source: doc.provider_meta?.source_name || doc.source,
  sentiment_score: doc.sentiment?.score ?? 0,
  sentiment_label: doc.sentiment?.label ?? "neutral",
  asset: doc.primary_asset,
  timestamp: doc.published_at
});

// "Recent" bound for the gauge / social read, independent of the selected
// range — so a stale headline can't present as a live reading.
const RECENT_MS = 72 * 60 * 60 * 1000;

const readDocsByType = async (symbol, types, limit) =>
  RawDocument.find({
    primary_asset: symbol,
    source_type: { $in: types },
    published_at: { $gte: new Date(Date.now() - RECENT_MS) },
    ...qualityFilter
  })
    .sort({ published_at: -1 })
    .limit(Number(limit))
    .lean();

const readNewsDocs = (symbol, limit) => readDocsByType(symbol, ["news"], limit);

// Freshness from how old the newest *published* item is (not when we fetched).
// NewsAPI's free tier lags ~24h, so "delayed" is the honest label for it.
const publishedFreshness = (docs) => {
  const newest = docs.reduce(
    (max, d) => Math.max(max, d.published_at ? new Date(d.published_at).getTime() : 0),
    0
  );
  const ageMs = Date.now() - newest;
  if (ageMs < 90 * 60 * 1000) return DATA_SOURCE.LIVE;
  if (ageMs < 24 * 60 * 60 * 1000) return DATA_SOURCE.DELAYED;
  return DATA_SOURCE.CACHED;
};

/** Retail/forum social sentiment for one asset (StockTwits, Reddit, ...). */
const getSocialSentiment = async (asset = "BTC", limit = 40) => {
  const symbol = normalizeAsset(asset).symbol;
  const empty = {
    data_source: DATA_SOURCE.UNAVAILABLE,
    count: 0,
    score_percent: null,
    label: null,
    bull_bear_ratio: null
  };
  if (!isMongoReady()) return empty;

  const raw = await readDocsByType(symbol, ["social", "forum"], limit * 2);
  // Drop suspected-bot / spam posts from the aggregate.
  const docs = raw.filter((d) => (d.author?.quality ?? 1) >= 0.3).slice(0, limit);
  if (docs.length < 3) return empty;

  const summary = averageSentiment(docs.map(toItem));
  const bull = docs.filter((d) => d.sentiment?.label === "positive").length;
  const bear = docs.filter((d) => d.sentiment?.label === "negative").length;

  return {
    data_source: publishedFreshness(docs),
    count: docs.length,
    score_percent: summary.scorePercent,
    label: summary.label,
    bull_bear_ratio: bear ? Number((bull / bear).toFixed(2)) : bull ? bull : 1
  };
};

// Reads never ingest — the scheduler keeps RawDocument fresh. `refresh` is
// accepted for backwards compatibility but ignored.
const getLatestSentiment = async (asset = "BTC", limit = 20, _refresh = true) => {
  const assetConfig = normalizeAsset(asset);
  const symbol = assetConfig.symbol;

  let dataSource = DATA_SOURCE.UNAVAILABLE;
  let items = [];

  if (isMongoReady()) {
    const docs = await readNewsDocs(symbol, limit);
    items = docs.map(toItem);
    if (items.length) dataSource = publishedFreshness(docs);
  }

  if (!items.length) {
    const mock = syntheticOrNull("news", () => makeMockNews(assetConfig, limit));
    if (mock) {
      items = mock;
      dataSource = DATA_SOURCE.SIMULATED;
    }
  }

  const summary = averageSentiment(items);

  return {
    asset: symbol,
    assetName: assetConfig.displayName,
    score_avg: summary.score,
    score_percent: summary.scorePercent,
    sentiment_label: summary.label,
    data_source: dataSource,
    as_of: newestTimestamp(items),
    computed_at: new Date().toISOString(),
    items
  };
};

// Bucket width scales with the range — news is sparse, minute buckets leave
// most windows with too few points to plot.
const BUCKET_MINUTES = { "5m": 1, "1h": 5, "24h": 30 };
const toPercent = (score) => Math.round(((score + 1) / 2) * 100);

const getSentimentTrend = async (asset = "BTC", range = "1h") => {
  const assetConfig = normalizeAsset(asset);
  const minutes = toMinutes(range);
  const binSize = BUCKET_MINUTES[String(range).toLowerCase()] || 5;

  const degrade = () => {
    const mock = syntheticOrNull("trend", () => makeMockTrend(assetConfig, Math.min(minutes, 240)));
    return mock
      ? { asset: assetConfig.symbol, range, points: mock, data_source: DATA_SOURCE.SIMULATED }
      : { asset: assetConfig.symbol, range, points: [], data_source: DATA_SOURCE.UNAVAILABLE };
  };

  if (!isMongoReady()) return degrade();

  const since = new Date(Date.now() - minutes * 60 * 1000);
  const rows = await RawDocument.aggregate([
    {
      $match: {
        primary_asset: assetConfig.symbol,
        source_type: "news",
        published_at: { $gte: since },
        ...qualityFilter
      }
    },
    {
      $group: {
        _id: { $dateTrunc: { date: "$published_at", unit: "minute", binSize } },
        sentiment_avg: { $avg: "$sentiment.score" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  if (!rows.length) {
    // Distinguish "no data at all" (degrade to mock in dev) from a genuinely
    // quiet window when we do hold recent news for this asset.
    const hasRecent = await RawDocument.exists({
      primary_asset: assetConfig.symbol,
      source_type: "news",
      published_at: { $gte: new Date(Date.now() - RECENT_MS) },
      ...qualityFilter
    });
    if (hasRecent) {
      return { asset: assetConfig.symbol, range, points: [], data_source: DATA_SOURCE.LIVE };
    }
    return degrade();
  }

  const points = rows.map((r) => ({
    timestamp: new Date(r._id).toISOString(),
    sentiment_avg: Number(r.sentiment_avg.toFixed(4)),
    sentiment_percent: toPercent(r.sentiment_avg),
    count: r.count
  }));

  return {
    asset: assetConfig.symbol,
    range,
    points,
    data_source: publishedFreshness([{ published_at: points[points.length - 1].timestamp }])
  };
};

/**
 * Robust sentiment change over the window: mean of the second half minus the
 * first half, in percentage points. Uses news + social + forum (news alone is
 * often too sparse for equities on the free tier). Returns null without enough
 * real data on both sides of the split.
 */
const getSentimentChange = async (asset = "BTC", range = "1h") => {
  const symbol = normalizeAsset(asset).symbol;
  if (!isMongoReady()) return null;

  const minutes = toMinutes(range);
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const docs = await RawDocument.find({
    primary_asset: symbol,
    source_type: { $in: ["news", "social", "forum"] },
    published_at: { $gte: since },
    ...qualityFilter
  })
    .select("published_at sentiment.score")
    .sort({ published_at: 1 })
    .lean();

  if (docs.length < 4) return null;

  // Split at the median document time (news clusters — a fixed window midpoint
  // often leaves one side empty).
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const half = Math.floor(docs.length / 2);
  const early = docs.slice(0, half).map((d) => d.sentiment?.score ?? 0);
  const late = docs.slice(half).map((d) => d.sentiment?.score ?? 0);

  return Number((toPercent(mean(late)) - toPercent(mean(early))).toFixed(2));
};

/** Recent structured events for one asset (SEC filings; LLM-classified news in M3). */
const getRecentEvents = async (asset = "BTC", limit = 5) => {
  const symbol = normalizeAsset(asset).symbol;
  if (!isMongoReady()) return [];

  const docs = await RawDocument.find({
    primary_asset: symbol,
    "event.type": { $ne: null },
    published_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  })
    .sort({ published_at: -1 })
    .limit(limit)
    .lean();

  return docs.map((d) => ({
    type: d.event.type,
    impact: d.event.impact,
    source: d.source,
    title: d.title,
    url: d.url,
    at: d.published_at
  }));
};

module.exports = {
  getLatestSentiment,
  getSentimentTrend,
  getSentimentChange,
  getSocialSentiment,
  getRecentEvents,
  toMinutes
};
