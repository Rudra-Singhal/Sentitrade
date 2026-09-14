const mongoose = require("mongoose");
const RawDocument = require("../models/RawDocument");
const SentimentFeatures = require("../models/SentimentFeatures");
const { normalizeAsset } = require("../services/assetService");
const { DATA_SOURCE } = require("../lib/dataSource");
const logger = require("../config/logger");
const { errInfo } = logger;

/**
 * M3 roadmap §"Feature store": aggregate scored documents into
 * SentimentFeatures on a schedule, per aggregation rules —
 * engagement-weighted x credibility-weighted x recency-decayed mean; require
 * doc_count >= a floor before emitting a real number; robust (trimmed) mean;
 * widen the window automatically when sparse. A sparse asset comes back
 * `unavailable`, never a noisy number computed from 1-2 documents.
 */

const MIN_DOCS = 3;
const TRIM_FRACTION = 0.1; // drop the top/bottom 10% by score before averaging
const TRIM_MIN_DOCS = 5; // trimming needs enough documents to mean anything
const RECENCY_HALF_LIFE_HOURS = 6;
const EWMA_FAST_PERIODS = 3;
const EWMA_SLOW_PERIODS = 12;
const MAX_ENGAGEMENT_WEIGHT = 3;

const round = (n, dp = 4) => Number(n.toFixed(dp));

/** credibility x engagement x recency-decay — the roadmap's weighting rule, per document. */
const weightFor = (doc, bucketEndMs) => {
  const credibility = typeof doc.source_weight === "number" ? doc.source_weight : 0.5;

  const eng = doc.engagement || {};
  const total = (eng.likes || 0) + (eng.shares || 0) + (eng.comments || 0) + (eng.upvotes || 0);
  const engagementWeight = Math.min(MAX_ENGAGEMENT_WEIGHT, 1 + Math.log10(1 + total));

  const publishedMs = doc.published_at ? new Date(doc.published_at).getTime() : bucketEndMs;
  const ageHours = Math.max(0, (bucketEndMs - publishedMs) / 3_600_000);
  const recency = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);

  return credibility * engagementWeight * recency;
};

const weightedMeanAndStdev = (values, weights) => {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (!totalWeight) return { mean: null, stdev: null };
  const mean = values.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
  const variance =
    values.reduce((sum, v, i) => sum + weights[i] * (v - mean) ** 2, 0) / totalWeight;
  return { mean: round(mean), stdev: round(Math.sqrt(variance)) };
};

/**
 * Pure aggregation over already-fetched documents — no I/O, fully unit
 * testable with hand-built docs.
 *
 * @param {object[]} docs  RawDocuments already filtered to the window and to
 *   quality (relevance >= 0.35, not a near-duplicate) by the caller
 * @param {{ bucketEndMs: number, prevFeatures?: object|null, historicalCounts?: number[] }} ctx
 */
const aggregateDocs = (docs, { bucketEndMs, prevFeatures = null, historicalCounts = [] } = {}) => {
  const sourceBreakdown = {};
  for (const d of docs) sourceBreakdown[d.source_type] = (sourceBreakdown[d.source_type] || 0) + 1;

  const scored = docs.filter((d) => typeof d.sentiment?.score === "number");
  const docCount = scored.length;

  const empty = {
    doc_count: docCount,
    source_breakdown: sourceBreakdown,
    sentiment_weighted: null,
    sentiment_dispersion: null,
    bull_bear_ratio: null,
    breadth: null,
    sentiment_ewma_fast: null,
    sentiment_ewma_slow: null,
    momentum: null,
    abnormal_volume_z: null,
    event_flags: [],
    news_retail_divergence: null
  };

  // Sparse: don't compute a number from too little evidence. Widening the
  // query window (not done here — see computeAndStoreFeatures) is the first
  // remedy; if it's still this thin, `unavailable` is the honest answer.
  if (docCount < MIN_DOCS) return { ...empty, sparse: true };

  const weighted = scored.map((d) => ({
    score: d.sentiment.score,
    weight: weightFor(d, bucketEndMs)
  }));
  weighted.sort((a, b) => a.score - b.score);

  const trimCount = docCount >= TRIM_MIN_DOCS ? Math.floor(docCount * TRIM_FRACTION) : 0;
  const trimmed = trimCount ? weighted.slice(trimCount, docCount - trimCount) : weighted;

  const { mean, stdev } = weightedMeanAndStdev(
    trimmed.map((t) => t.score),
    trimmed.map((t) => t.weight)
  );

  const positive = scored.filter((d) => d.sentiment.label === "positive").length;
  const negative = scored.filter((d) => d.sentiment.label === "negative").length;
  const bullBearRatio = negative ? round(positive / negative, 2) : positive || 1;
  const breadth = round((positive - negative) / docCount);

  const alphaFast = 2 / (EWMA_FAST_PERIODS + 1);
  const alphaSlow = 2 / (EWMA_SLOW_PERIODS + 1);
  // No prior bucket yet (first time this asset/bucket-size has enough data) —
  // seed both EWMAs at the current mean rather than at zero, so momentum
  // starts at 0 instead of falsely spiking on bucket one.
  const prevFast = prevFeatures?.sentiment_ewma_fast ?? mean;
  const prevSlow = prevFeatures?.sentiment_ewma_slow ?? mean;
  const ewmaFast = round(alphaFast * mean + (1 - alphaFast) * prevFast);
  const ewmaSlow = round(alphaSlow * mean + (1 - alphaSlow) * prevSlow);
  const momentum = round(ewmaFast - ewmaSlow);

  let abnormalVolumeZ = null;
  if (historicalCounts.length >= 5) {
    const hMean = historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length;
    const hVariance =
      historicalCounts.reduce((s, v) => s + (v - hMean) ** 2, 0) / historicalCounts.length;
    const hStdev = Math.sqrt(hVariance);
    abnormalVolumeZ = hStdev > 0 ? round((docCount - hMean) / hStdev, 2) : 0;
  }

  const eventFlags = Array.from(
    new Set(docs.filter((d) => d.event?.type).map((d) => d.event.type))
  );

  const newsScores = scored.filter((d) => d.source_type === "news").map((d) => d.sentiment.score);
  const socialScores = scored
    .filter((d) => d.source_type === "social" || d.source_type === "forum")
    .map((d) => d.sentiment.score);
  const newsRetailDivergence =
    newsScores.length && socialScores.length
      ? round(
          newsScores.reduce((a, b) => a + b, 0) / newsScores.length -
            socialScores.reduce((a, b) => a + b, 0) / socialScores.length
        )
      : null;

  return {
    doc_count: docCount,
    source_breakdown: sourceBreakdown,
    sentiment_weighted: mean,
    sentiment_dispersion: stdev,
    bull_bear_ratio: bullBearRatio,
    breadth,
    sentiment_ewma_fast: ewmaFast,
    sentiment_ewma_slow: ewmaSlow,
    momentum,
    abnormal_volume_z: abnormalVolumeZ,
    event_flags: eventFlags,
    news_retail_divergence: newsRetailDivergence,
    sparse: false
  };
};

const RELEVANCE_MIN = 0.35;
const qualityFilter = {
  relevance: { $not: { $lt: RELEVANCE_MIN } },
  is_duplicate: { $ne: true }
};

// Widen up to 4x the requested bucket before accepting `unavailable`.
const WIDEN_MULTIPLIERS = [1, 2, 4];

/**
 * Compute and upsert the feature row for one (asset, bucket_size) at `now`.
 * Never throws — a feature-store failure must not affect ingestion, which
 * this runs after. Returns null if there's no DB connection or on error.
 */
const computeAndStoreFeatures = async (assetInput, bucketSizeMinutes = 60, now = new Date()) => {
  if (mongoose.connection.readyState !== 1) return null;

  try {
    const symbol = normalizeAsset(assetInput).symbol;
    const bucketEndMs = now.getTime();

    let docs = [];
    let windowMinutesUsed = bucketSizeMinutes;
    for (const multiplier of WIDEN_MULTIPLIERS) {
      windowMinutesUsed = bucketSizeMinutes * multiplier;
      const since = new Date(bucketEndMs - windowMinutesUsed * 60_000);
      docs = await RawDocument.find({
        primary_asset: symbol,
        published_at: { $gte: since },
        ...qualityFilter
      }).lean();
      if (docs.length >= MIN_DOCS) break;
    }

    const [prevFeatures, history] = await Promise.all([
      SentimentFeatures.findOne({ asset: symbol, bucket_size_minutes: bucketSizeMinutes })
        .sort({ bucket_start: -1 })
        .lean(),
      SentimentFeatures.find({ asset: symbol, bucket_size_minutes: bucketSizeMinutes })
        .sort({ bucket_start: -1 })
        .limit(20)
        .lean()
    ]);

    const { sparse, ...agg } = aggregateDocs(docs, {
      bucketEndMs,
      prevFeatures,
      historicalCounts: history.map((h) => h.doc_count)
    });

    const bucketMs = bucketSizeMinutes * 60_000;
    const bucketStart = new Date(Math.floor(bucketEndMs / bucketMs) * bucketMs);

    const dataSource = sparse
      ? DATA_SOURCE.UNAVAILABLE
      : docs.length && windowMinutesUsed > bucketSizeMinutes
        ? DATA_SOURCE.DELAYED // had to widen the window — real data, just not from the intended window
        : DATA_SOURCE.LIVE;

    return await SentimentFeatures.findOneAndUpdate(
      { asset: symbol, bucket_size_minutes: bucketSizeMinutes, bucket_start: bucketStart },
      { $set: { ...agg, window_minutes_used: windowMinutesUsed, data_source: dataSource } },
      { upsert: true, new: true }
    ).lean();
  } catch (err) {
    logger.warn({ asset: assetInput, err: errInfo(err) }, "feature store aggregation failed");
    return null;
  }
};

module.exports = { aggregateDocs, computeAndStoreFeatures, MIN_DOCS };
