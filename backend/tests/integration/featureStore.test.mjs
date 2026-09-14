import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let RawDocument;
let SentimentFeatures;
let computeAndStoreFeatures;

const NOW = new Date("2026-09-15T12:00:00.000Z");

const rawDoc = (overrides = {}) => ({
  source: "TestWire",
  source_type: "news",
  external_id: `id-${Math.random()}`,
  dedupe_key: `key-${Math.random()}`,
  source_weight: 0.5,
  title: "Some headline",
  text: "Some headline",
  primary_asset: "AAPL",
  published_at: NOW,
  relevance: 0.9,
  is_duplicate: false,
  sentiment: { score: 0.4, label: "positive", model: "test", model_version: "1", scored_at: NOW },
  ...overrides
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  RawDocument = (await import("../../src/models/RawDocument.js")).default;
  SentimentFeatures = (await import("../../src/models/SentimentFeatures.js")).default;
  ({ computeAndStoreFeatures } = await import("../../src/pipeline/featureStore.js"));
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await RawDocument.deleteMany({});
  await SentimentFeatures.deleteMany({});
});

describe("computeAndStoreFeatures (real MongoDB)", () => {
  it("persists a real feature row from real documents, live=data_source when the bucket isn't widened", async () => {
    await RawDocument.insertMany([
      rawDoc(),
      rawDoc(),
      rawDoc({ sentiment: { score: -0.2, label: "negative" } })
    ]);

    const feature = await computeAndStoreFeatures("AAPL", 60, NOW);

    expect(feature).not.toBeNull();
    expect(feature.asset).toBe("AAPL");
    expect(feature.doc_count).toBe(3);
    expect(feature.data_source).toBe("live");
    expect(feature.window_minutes_used).toBe(60);
    expect(feature.sentiment_weighted).not.toBeNull();

    const stored = await SentimentFeatures.findOne({
      asset: "AAPL",
      bucket_size_minutes: 60
    }).lean();
    expect(stored).not.toBeNull();
    expect(stored.doc_count).toBe(3);
  });

  it("widens the window and marks data_source=delayed when the exact bucket is too sparse", async () => {
    // Only 1 doc in the last 60 minutes, but 2 more just outside it (within
    // the 2x-widened 120-minute window) — 3 total clears MIN_DOCS.
    await RawDocument.insertMany([
      rawDoc({ published_at: NOW }),
      rawDoc({ published_at: new Date(NOW.getTime() - 90 * 60_000) }),
      rawDoc({ published_at: new Date(NOW.getTime() - 100 * 60_000) })
    ]);

    const feature = await computeAndStoreFeatures("AAPL", 60, NOW);

    expect(feature.doc_count).toBe(3);
    expect(feature.window_minutes_used).toBe(120); // had to widen once
    expect(feature.data_source).toBe("delayed"); // real data, just not from the intended window
  });

  it("stores unavailable, not a fabricated number, when even the widest window is too sparse", async () => {
    await RawDocument.insertMany([rawDoc(), rawDoc()]); // 2 docs, everywhere, below MIN_DOCS

    const feature = await computeAndStoreFeatures("AAPL", 60, NOW);

    expect(feature.data_source).toBe("unavailable");
    expect(feature.sentiment_weighted).toBeNull();
    expect(feature.doc_count).toBe(2); // still reports what it found — just refuses to score it
  });

  it("excludes low-relevance and near-duplicate documents from the aggregate, same as the existing read path", async () => {
    await RawDocument.insertMany([
      rawDoc(),
      rawDoc(),
      rawDoc(),
      rawDoc({ relevance: 0.1 }), // below the 0.35 floor
      rawDoc({ is_duplicate: true })
    ]);

    const feature = await computeAndStoreFeatures("AAPL", 60, NOW);
    expect(feature.doc_count).toBe(3); // the 2 excluded ones don't count
  });

  it("carries momentum forward across two real, sequential buckets", async () => {
    await RawDocument.insertMany([rawDoc(), rawDoc(), rawDoc()]);
    const first = await computeAndStoreFeatures("AAPL", 60, NOW);
    expect(first.momentum).toBe(0); // no prior bucket yet

    const later = new Date(NOW.getTime() + 61 * 60_000); // next 60-min bucket
    await RawDocument.insertMany([
      rawDoc({ published_at: later, sentiment: { score: 0.9, label: "positive" } }),
      rawDoc({ published_at: later, sentiment: { score: 0.9, label: "positive" } }),
      rawDoc({ published_at: later, sentiment: { score: 0.9, label: "positive" } })
    ]);
    const second = await computeAndStoreFeatures("AAPL", 60, later);

    // A real jump toward positive should show up as positive momentum, read
    // from an actual prior row in the database, not synthesized in-memory.
    expect(second.sentiment_ewma_fast).toBeGreaterThan(first.sentiment_ewma_fast);
    expect(second.momentum).toBeGreaterThan(0);
  });

  it("returns null instead of throwing when there is no database connection", async () => {
    await mongoose.disconnect();
    const result = await computeAndStoreFeatures("AAPL", 60, NOW);
    expect(result).toBeNull();
    await mongoose.connect(mongod.getUri()); // reconnect for the remaining tests
  });
});
