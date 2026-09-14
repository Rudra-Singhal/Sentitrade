const mongoose = require("mongoose");

/**
 * Content-addressed sentiment cache. Key is sha1(route + cleaned text) — see
 * pipeline/sentimentCache.js — so the same headline scored twice, by the same
 * connector or two different ones, costs one model call instead of two.
 *
 * Only genuine model results are stored here (never a VADER fallback caused by
 * the service being down or a transient inference failure) — see score.js.
 * That keeps a cache hit meaning "this exact text, scored by the real model",
 * not "whatever answer happened to be available last time".
 */
const sentimentCacheSchema = new mongoose.Schema(
  {
    _id: { type: String }, // the hash itself; no separate ObjectId needed
    score: { type: Number, required: true, min: -1, max: 1 },
    label: { type: String, required: true, enum: ["positive", "negative", "neutral"] },
    confidence: { type: Number, default: null },
    model: { type: String, required: true },
    model_version: { type: String, required: true },
    hits: { type: Number, default: 0 } // times served from cache after the first write
  },
  { timestamps: true }
);

// Bound growth the same way RawDocument does — a 180-day-old cache entry is
// worth recomputing anyway if that text somehow resurfaces.
sentimentCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports =
  mongoose.models.SentimentCache || mongoose.model("SentimentCache", sentimentCacheSchema);
