const mongoose = require("mongoose");

/**
 * Canonical document produced by every source connector after normalization.
 * One shape for news, social, forum, filings and derived signals so the
 * aggregation / feature layer never needs to know where a document came from.
 *
 * See V2_ROADMAP.md §5.3.
 */
const rawDocumentSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, index: true }, // newsapi | finnhub | rss | stocktwits | reddit | edgar | ...
    source_type: {
      type: String,
      required: true,
      enum: ["news", "social", "forum", "filing", "derived"]
    },
    external_id: { type: String, default: null }, // provider's own id, when it has one

    // sha1 of normalized title/text — the real dedupe key (short strings only).
    dedupe_key: { type: String, required: true, unique: true },

    // near-duplicate clustering (SimHash) — same story across sources
    simhash: { type: String, default: null },
    cluster_id: { type: String, default: null, index: true },
    is_duplicate: { type: Boolean, default: false },

    // base credibility weight of the source (see config/sources.js)
    source_weight: { type: Number, default: 0.5 },

    url: { type: String, default: null },
    author: {
      handle: { type: String, default: null },
      followers: { type: Number, default: null },
      account_age_days: { type: Number, default: null }
    },

    title: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
    lang: { type: String, default: "en" },

    published_at: { type: Date, required: true },
    ingested_at: { type: Date, default: Date.now },

    // Resolved to our asset universe by the entity-resolution stage.
    primary_asset: { type: String, required: true, uppercase: true, index: true },
    assets: { type: [String], default: [] },
    entities: {
      type: [
        {
          _id: false,
          symbol: String,
          name: String,
          mentions: Number,
          salience: Number,
          cashtag: Boolean
        }
      ],
      default: []
    },
    // 0..1 — how much this document is actually about `primary_asset`.
    relevance: { type: Number, default: null },

    engagement: {
      likes: { type: Number, default: null },
      shares: { type: Number, default: null },
      comments: { type: Number, default: null },
      upvotes: { type: Number, default: null },
      views: { type: Number, default: null }
    },

    sentiment: {
      score: { type: Number, default: null },
      label: { type: String, enum: ["positive", "neutral", "negative", null], default: null },
      model: { type: String, default: null },
      model_version: { type: String, default: null },
      scored_at: { type: Date, default: null }
    },

    provider_meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

rawDocumentSchema.index({ primary_asset: 1, published_at: -1 });
rawDocumentSchema.index({ source: 1, published_at: -1 });
// Retention: drop raw documents after 90 days (rollups keep the history).
rawDocumentSchema.index({ published_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.models.RawDocument || mongoose.model("RawDocument", rawDocumentSchema);
