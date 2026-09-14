const mongoose = require("mongoose");
const RawDocument = require("../models/RawDocument");
const logger = require("../config/logger");
const { errInfo } = logger;

const isMongoReady = () => mongoose.connection.readyState === 1;

/**
 * Insert-if-new by dedupe_key. Existing documents are left untouched
 * (we never overwrite a score or timestamp we already stored).
 */
const persist = async (docs) => {
  if (!isMongoReady() || !docs.length) return { upserted: 0, matched: 0 };

  try {
    const res = await RawDocument.bulkWrite(
      docs.map((d) => ({
        updateOne: {
          filter: { dedupe_key: d.dedupe_key },
          update: { $setOnInsert: d },
          upsert: true
        }
      })),
      { ordered: false }
    );
    return { upserted: res.upsertedCount || 0, matched: res.matchedCount || 0 };
  } catch (err) {
    if (err.code !== 11000) logger.warn({ err: errInfo(err) }, "persist bulkWrite issue");
    return { upserted: 0, matched: 0, error: errInfo(err).message };
  }
};

module.exports = { persist };
