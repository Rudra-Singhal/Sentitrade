const mongoose = require("mongoose");
const RawDocument = require("../models/RawDocument");
const { simhash, isNearDuplicate } = require("../lib/simhash");
const { isRewordedDuplicate } = require("../lib/textSimilarity");

const WINDOW_MS = 48 * 60 * 60 * 1000;

const looksSame = (a, b) =>
  isNearDuplicate(a.simhash, b.simhash) || isRewordedDuplicate(a.headline, b.headline);

/**
 * Compute a SimHash for each doc and flag near-duplicates — the same story
 * reworded, republished, or picked up by several sources. The first
 * occurrence in a cluster stays `is_duplicate: false`; the rest are flagged
 * and excluded from the sentiment read/aggregation (counted once per cluster).
 *
 * Compares against other docs in the same batch AND recent stored docs for
 * the asset. Mutates `docs` in place; returns the number flagged.
 */
const flagNearDuplicates = async (assetSymbol, docs) => {
  if (!docs.length) return 0;

  let recent = [];
  if (mongoose.connection.readyState === 1) {
    const rows = await RawDocument.find({
      primary_asset: assetSymbol,
      ingested_at: { $gte: new Date(Date.now() - WINDOW_MS) },
      is_duplicate: { $ne: true }
    })
      .select("simhash dedupe_key cluster_id title text")
      .lean();
    recent = rows.map((r) => ({
      simhash: r.simhash || simhash(r.title || r.text),
      headline: r.title || r.text || "",
      clusterId: r.cluster_id || r.dedupe_key
    }));
  }

  const seen = [...recent];
  let flagged = 0;

  for (const doc of docs) {
    doc.simhash = simhash(doc.title || doc.text);
    const candidate = { simhash: doc.simhash, headline: doc.title || doc.text || "" };
    const match = seen.find((s) => looksSame(s, candidate));

    if (match) {
      doc.is_duplicate = true;
      doc.cluster_id = match.clusterId;
      flagged += 1;
    } else {
      doc.is_duplicate = false;
      doc.cluster_id = doc.dedupe_key;
      seen.push({ ...candidate, clusterId: doc.dedupe_key });
    }
  }

  return flagged;
};

module.exports = { flagNearDuplicates };
