const crypto = require("crypto");
const mongoose = require("mongoose");
const SentimentCache = require("../models/SentimentCache");
const logger = require("../config/logger");
const { errInfo } = logger;

/**
 * Content-hash cache for sentiment scores (M3 roadmap §"Content-hash cache").
 *
 * Every function here degrades to a no-op when Mongo isn't connected — the
 * same pattern the rest of the pipeline uses for optional dependencies. A
 * cache miss just means "score it", never a thrown error, so unit tests that
 * exercise scoreDocuments() without a database keep working unchanged.
 */

const cleanText = (text) =>
  String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * The cache key includes the routing (source_type + asset_class), not just the
 * text: identical text can legitimately route to a different model depending
 * on what asset it's about (crypto news vs. equity news use different models —
 * see sentiment-service/app/router.py), and the cache must never return one
 * model's answer for a document that would route to another.
 */
const cacheKey = (text, sourceType, assetClass) =>
  crypto
    .createHash("sha1")
    .update(`${sourceType || "news"}:${assetClass || "equity"}:${cleanText(text)}`)
    .digest("hex");

const dbReady = () => mongoose.connection.readyState === 1;

/** @returns {Promise<Map<string, object>>} key -> cached row (lean, no doc methods) */
const getMany = async (keys) => {
  const hits = new Map();
  const unique = Array.from(new Set(keys));
  if (!unique.length || !dbReady()) return hits;

  try {
    const rows = await SentimentCache.find({ _id: { $in: unique } }).lean();
    for (const row of rows) hits.set(row._id, row);
    if (rows.length) {
      SentimentCache.updateMany(
        { _id: { $in: rows.map((r) => r._id) } },
        { $inc: { hits: 1 } }
      ).catch(
        () => {} // hit-count is a metric, not correctness — never let it fail a request
      );
    }
  } catch (err) {
    logger.warn({ err: errInfo(err) }, "sentiment cache read failed — scoring uncached");
  }
  return hits;
};

/** @param {{key: string, score: number, label: string, confidence: number|null, model: string, model_version: string}[]} entries */
const setMany = async (entries) => {
  if (!entries.length || !dbReady()) return;
  try {
    await SentimentCache.bulkWrite(
      entries.map(({ key, ...fields }) => ({
        updateOne: { filter: { _id: key }, update: { $set: fields }, upsert: true }
      })),
      { ordered: false }
    );
  } catch (err) {
    logger.warn({ err: errInfo(err) }, "sentiment cache write failed — results are still returned");
  }
};

module.exports = { cleanText, cacheKey, getMany, setMany };
