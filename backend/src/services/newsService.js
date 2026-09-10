const mongoose = require("mongoose");
const RawDocument = require("../models/RawDocument");
const { normalizeAsset } = require("./assetService");
const { averageSentiment } = require("./sentimentService");
const { makeMockNews, makeMockTrend } = require("./mockDataService");
const { syntheticOrNull } = require("../lib/fallback");
const { DATA_SOURCE } = require("../lib/dataSource");

// A read is "live" if the freshest stored document was ingested within this
// window (the scheduler polls every 120s). Older -> "cached".
const LIVE_FRESHNESS_MS = 10 * 60 * 1000;

// Documents scoring below this are kept in the store but excluded from the
// sentiment read/trend (off-topic mentions, query noise). `$not $lt` also
// matches pre-M2 documents that have no relevance score.
const RELEVANCE_MIN = 0.35;
const relevanceFilter = { relevance: { $not: { $lt: RELEVANCE_MIN } } };

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

const readNewsDocs = async (symbol, limit) =>
  RawDocument.find({ primary_asset: symbol, source_type: "news", ...relevanceFilter })
    .sort({ published_at: -1 })
    .limit(Number(limit))
    .lean();

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
    if (items.length) {
      const freshestIngest = docs.reduce(
        (max, d) => Math.max(max, d.ingested_at ? new Date(d.ingested_at).getTime() : 0),
        0
      );
      dataSource =
        Date.now() - freshestIngest < LIVE_FRESHNESS_MS ? DATA_SOURCE.LIVE : DATA_SOURCE.CACHED;
    }
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

const getSentimentTrend = async (asset = "BTC", range = "1h") => {
  const assetConfig = normalizeAsset(asset);
  const minutes = toMinutes(range);

  const degrade = () => {
    const mock = syntheticOrNull("trend", () => makeMockTrend(assetConfig, Math.min(minutes, 240)));
    return mock
      ? { asset: assetConfig.symbol, range, points: mock, data_source: DATA_SOURCE.SIMULATED }
      : { asset: assetConfig.symbol, range, points: [], data_source: DATA_SOURCE.UNAVAILABLE };
  };

  if (!isMongoReady()) return degrade();

  const since = new Date(Date.now() - minutes * 60 * 1000);
  const points = await RawDocument.aggregate([
    {
      $match: {
        primary_asset: assetConfig.symbol,
        source_type: "news",
        published_at: { $gte: since },
        ...relevanceFilter
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            date: "$published_at",
            format: "%Y-%m-%dT%H:%M:00.000Z",
            timezone: "UTC"
          }
        },
        sentiment_avg: { $avg: "$sentiment.score" },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        timestamp: "$_id",
        sentiment_avg: { $round: ["$sentiment_avg", 4] },
        count: 1
      }
    }
  ]);

  if (!points.length) return degrade();

  return {
    asset: assetConfig.symbol,
    range,
    points: points.map((p) => ({
      ...p,
      sentiment_percent: Math.round(((p.sentiment_avg + 1) / 2) * 100)
    })),
    data_source: DATA_SOURCE.LIVE
  };
};

module.exports = { getLatestSentiment, getSentimentTrend, toMinutes };
