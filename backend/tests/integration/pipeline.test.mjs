import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let ingestAsset;
let RawDocument;
let getLatestSentiment;
let getSentimentTrend;

const fakeConnector = (id, docs, opts = {}) => ({
  id,
  sourceType: "news",
  enabled: true,
  fetch: async () => {
    if (opts.throws) throw new Error(opts.throws);
    return docs;
  }
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  ({ ingestAsset } = await import("../../src/pipeline/ingest.js"));
  RawDocument = (await import("../../src/models/RawDocument.js")).default;
  ({ getLatestSentiment, getSentimentTrend } = await import("../../src/services/newsService.js"));
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await RawDocument.deleteMany({});
});

const article = (text, ago = 0) => ({
  text,
  title: text,
  url: `https://example.com/${encodeURIComponent(text).slice(0, 20)}`,
  published_at: new Date(Date.now() - ago * 60000).toISOString(),
  provider_meta: { source_name: "CoinDesk" }
});

describe("ingestAsset", () => {
  it("normalizes, scores and persists connector docs, deduping re-fetches", async () => {
    const connectors = [
      fakeConnector("newsapi", [article("Bitcoin ETF inflows accelerate as demand improves")])
    ];

    const first = await ingestAsset("BTC", { limit: 10, connectors });
    expect(first.new).toBe(1);
    expect(first.fetchedAny).toBe(true);

    const second = await ingestAsset("BTC", { limit: 10, connectors });
    expect(second.new).toBe(0);

    const docs = await RawDocument.find({ primary_asset: "BTC" }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].sentiment.model).toBe("vader");
    expect(docs[0].sentiment.label).toBe("positive");
    expect(docs[0].source).toBe("newsapi");
    expect(docs[0].source_type).toBe("news");
    expect(docs[0].entities.some((e) => e.symbol === "BTC")).toBe(true);
    expect(docs[0].relevance).toBeGreaterThan(0.35);
  });

  it("stores an off-topic doc but excludes it from the sentiment read", async () => {
    await ingestAsset("BTC", {
      limit: 10,
      connectors: [
        fakeConnector("newsapi", [
          article("Bitcoin ETF demand climbs as investors stay optimistic"),
          {
            ...article("Fed holds rates steady as equity indices drift"),
            text: "Bond yields eased slightly and traders stayed on the sidelines."
          }
        ])
      ]
    });

    const stored = await RawDocument.countDocuments({ primary_asset: "BTC" });
    expect(stored).toBe(2);

    const snap = await getLatestSentiment("BTC", 10, false);
    expect(snap.items).toHaveLength(1); // the passing-mention doc is filtered
    expect(snap.items[0].text).toMatch(/ETF demand/);
  });

  it("isolates a failing connector and still records the others", async () => {
    const connectors = [
      fakeConnector("bad", [], { throws: "provider 500" }),
      fakeConnector("good", [article("Ether staking activity rises")])
    ];
    const result = await ingestAsset("ETH", { limit: 5, connectors });
    expect(result.new).toBe(1);
    expect(result.perSource.bad.error).toMatch(/provider 500/);
    expect(result.perSource.good.new).toBe(1);
  });
});

describe("newsService reads from RawDocument", () => {
  it("labels freshly-ingested docs 'live' and maps item fields", async () => {
    await ingestAsset("ETH", {
      limit: 10,
      connectors: [
        fakeConnector("newsapi", [article("Ether staking rises as layer two usage expands")])
      ]
    });

    const snap = await getLatestSentiment("ETH", 10, false);
    expect(snap.data_source).toBe("live"); // ingested_at is ~now
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0]).toMatchObject({ asset: "ETH", source: "CoinDesk" });
    expect(snap.as_of).toBeTruthy();
    expect(["positive", "neutral", "negative"]).toContain(snap.sentiment_label);
  });

  it("labels stale-ingest docs 'cached'", async () => {
    await RawDocument.create({
      source: "newsapi",
      source_type: "news",
      dedupe_key: `stale-${Math.random()}`,
      text: "An old but real headline about SOL",
      primary_asset: "SOL",
      assets: ["SOL"],
      published_at: new Date(Date.now() - 30 * 60000),
      ingested_at: new Date(Date.now() - 30 * 60000), // > 10min ago
      sentiment: {
        score: 0.1,
        label: "neutral",
        model: "vader",
        model_version: "x",
        scored_at: new Date()
      }
    });

    const snap = await getLatestSentiment("SOL", 10, false);
    expect(snap.data_source).toBe("cached");
  });

  it("builds a minute-bucketed trend and ignores docs outside the window", async () => {
    await ingestAsset("BTC", {
      limit: 10,
      connectors: [
        fakeConnector("newsapi", [
          article("Bitcoin demand improves and investors are optimistic", 1),
          article("Bitcoin volatility climbs after liquidations", 2),
          article("Old stale bitcoin story from days ago", 60 * 48)
        ])
      ]
    });

    const trend = await getSentimentTrend("BTC", "1h");
    expect(trend.data_source).toBe("live");
    expect(trend.points.length).toBeGreaterThanOrEqual(1);
    const totalCount = trend.points.reduce((s, p) => s + p.count, 0);
    expect(totalCount).toBe(2); // the 48h-old doc is excluded from a 1h window
    for (const p of trend.points) expect(p).toHaveProperty("sentiment_percent");
  });
});
