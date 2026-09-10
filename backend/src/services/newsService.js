const axios = require("axios");
const mongoose = require("mongoose");
const NewsSentiment = require("../models/NewsSentiment");
const { normalizeAsset } = require("./assetService");
const { analyzeHeadline, averageSentiment } = require("./sentimentService");
const { makeMockNews, makeMockTrend } = require("./mockDataService");
const { env } = require("../config/env");
const logger = require("../config/logger");
const { errInfo } = logger;
const metrics = require("../lib/metrics");
const { syntheticOrNull } = require("../lib/fallback");
const { DATA_SOURCE } = require("../lib/dataSource");

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

const buildNewsApiUrl = (assetConfig, limit) => {
  const params = new URLSearchParams({
    q: assetConfig.query,
    language: "en",
    pageSize: String(limit),
    sortBy: "publishedAt",
    apiKey: env.NEWS_API_KEY
  });

  return `https://newsapi.org/v2/everything?${params.toString()}`;
};

const mapArticle = (article, assetConfig) => {
  const text = article.title || article.description || "";
  const sentiment = analyzeHeadline(text);

  return {
    text,
    source: article.source?.name || "NewsAPI",
    sentiment_score: sentiment.sentiment_score,
    sentiment_label: sentiment.sentiment_label,
    asset: assetConfig.symbol,
    timestamp: article.publishedAt ? new Date(article.publishedAt) : new Date()
  };
};

const persistHeadlines = async (items) => {
  if (!isMongoReady() || !items.length) return items;

  try {
    await NewsSentiment.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { text: item.text, asset: item.asset },
          update: { $setOnInsert: item },
          upsert: true
        }
      })),
      { ordered: false }
    );
  } catch (err) {
    // Duplicate-key races are expected under concurrency; anything else is logged.
    if (err.code !== 11000) logger.warn({ err: errInfo(err) }, "persistHeadlines bulkWrite issue");
  }

  return items;
};

/**
 * @returns {{ items: object[], data_source: string }}
 */
const fetchNews = async (asset = "BTC", limit = 20) => {
  const assetConfig = normalizeAsset(asset);

  const degrade = (reason) => {
    logger.warn({ asset: assetConfig.symbol, reason }, "news feed unavailable");
    const mock = syntheticOrNull("news", () => makeMockNews(assetConfig, limit));
    return mock
      ? { items: mock, data_source: DATA_SOURCE.SIMULATED }
      : { items: [], data_source: DATA_SOURCE.UNAVAILABLE };
  };

  if (!env.NEWS_API_KEY) return degrade("no NEWS_API_KEY configured");

  try {
    const response = await axios.get(buildNewsApiUrl(assetConfig, limit), { timeout: 9000 });
    const articles = response.data?.articles || [];
    const mapped = articles
      .filter((article) => article.title)
      .map((article) => mapArticle(article, assetConfig));

    if (!mapped.length) return degrade("provider returned no usable articles");

    await persistHeadlines(mapped);
    metrics.inc("news_fetch_total:ok");
    metrics.markTimestamp("last_news_fetch_ok_at");
    return { items: mapped, data_source: DATA_SOURCE.LIVE };
  } catch (err) {
    metrics.inc("news_fetch_total:error");
    logger.warn({ asset: assetConfig.symbol, err: errInfo(err) }, "NewsAPI request failed");
    return degrade("provider request failed");
  }
};

const getLatestSentiment = async (asset = "BTC", limit = 20, refresh = true) => {
  const assetConfig = normalizeAsset(asset);
  let items = [];
  let dataSource = DATA_SOURCE.UNAVAILABLE;

  if (refresh) {
    const fetched = await fetchNews(assetConfig.symbol, limit);
    items = fetched.items;
    dataSource = fetched.data_source;
  }

  if (isMongoReady()) {
    const dbItems = await NewsSentiment.find({ asset: assetConfig.symbol })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    if (dbItems.length) {
      // Prefer the store; if we did not just fetch fresh, this is cached data.
      items = dbItems;
      if (dataSource !== DATA_SOURCE.LIVE) dataSource = DATA_SOURCE.CACHED;
    }
  }

  if (!items.length) {
    const mock = syntheticOrNull("news", () => makeMockNews(assetConfig, limit));
    if (mock) {
      items = mock;
      dataSource = DATA_SOURCE.SIMULATED;
    } else {
      items = [];
      dataSource = DATA_SOURCE.UNAVAILABLE;
    }
  }

  const summary = averageSentiment(items);

  return {
    asset: assetConfig.symbol,
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
  const points = await NewsSentiment.aggregate([
    { $match: { asset: assetConfig.symbol, timestamp: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: {
            date: "$timestamp",
            format: "%Y-%m-%dT%H:%M:00.000Z",
            timezone: "UTC"
          }
        },
        sentiment_avg: { $avg: "$sentiment_score" },
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

  const normalized = points.map((point) => ({
    ...point,
    sentiment_percent: Math.round(((point.sentiment_avg + 1) / 2) * 100)
  }));

  return {
    asset: assetConfig.symbol,
    range,
    points: normalized,
    data_source: DATA_SOURCE.LIVE
  };
};

module.exports = {
  fetchNews,
  getLatestSentiment,
  getSentimentTrend,
  toMinutes
};
