const mongoose = require("mongoose");

/**
 * Pre-aggregated sentiment for one (asset, bucket_size, bucket_start).
 *
 * M3 roadmap §"Feature store": a job aggregates scored RawDocuments into this
 * collection so trend/correlation/signal can eventually read one small,
 * precomputed row instead of re-scanning and re-weighting raw documents on
 * every request. See pipeline/featureStore.js for the aggregation itself.
 *
 * Not yet the sole read path — see the M3 phase 6 walkthrough for what that
 * migration would still need.
 */
const sentimentFeaturesSchema = new mongoose.Schema(
  {
    asset: { type: String, required: true, uppercase: true, index: true },
    bucket_start: { type: Date, required: true },
    bucket_size_minutes: { type: Number, required: true },
    // The window actually queried to fill this bucket. Equal to
    // bucket_size_minutes unless the bucket was sparse and got widened.
    window_minutes_used: { type: Number, required: true },

    data_source: {
      type: String,
      enum: ["live", "cached", "delayed", "simulated", "unavailable"],
      default: "unavailable"
    },

    doc_count: { type: Number, default: 0 },
    source_breakdown: { type: mongoose.Schema.Types.Mixed, default: {} }, // { news: 4, social: 2, ... }

    // credibility x engagement x recency-decayed, trimmed-mean weighted score.
    sentiment_weighted: { type: Number, default: null },
    sentiment_dispersion: { type: Number, default: null }, // weighted stdev — how much sources disagree
    bull_bear_ratio: { type: Number, default: null },
    breadth: { type: Number, default: null }, // (positive - negative) / doc_count, in [-1, 1]

    sentiment_ewma_fast: { type: Number, default: null },
    sentiment_ewma_slow: { type: Number, default: null },
    momentum: { type: Number, default: null }, // ewma_fast - ewma_slow

    abnormal_volume_z: { type: Number, default: null }, // doc_count vs. this asset's own recent baseline
    event_flags: { type: [String], default: [] }, // distinct event types present in this bucket
    news_retail_divergence: { type: Number, default: null } // news mean - social/forum mean, when both present
  },
  { timestamps: { createdAt: false, updatedAt: "updated_at" } }
);

sentimentFeaturesSchema.index(
  { asset: 1, bucket_size_minutes: 1, bucket_start: -1 },
  { unique: true }
);
// Bound growth the same way RawDocument does.
sentimentFeaturesSchema.index({ bucket_start: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports =
  mongoose.models.SentimentFeatures || mongoose.model("SentimentFeatures", sentimentFeaturesSchema);
