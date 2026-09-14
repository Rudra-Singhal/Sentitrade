import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// A tiny real HTTP server standing in for the Python sentiment service — this
// project's established pattern is testing against real components rather
// than mocking require(), and here that also means the cache is exercised
// against the real network client, not a stub of it.
let requestCount = 0;
const fakeService = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    requestCount += 1;
    const { items } = JSON.parse(body);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        results: items.map((item) => ({
          id: item.id,
          score: 0.7,
          label: "positive",
          confidence: 0.9,
          model: "fake/finbert",
          model_version: "test",
          degraded: false
        }))
      })
    );
  });
});

let mongod;
let scoreDocuments;

beforeAll(async () => {
  await new Promise((resolve) => fakeService.listen(0, resolve));
  const port = fakeService.address().port;
  process.env.SENTIMENT_SERVICE_URL = `http://127.0.0.1:${port}`;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ({ scoreDocuments } = await import("../../src/pipeline/score.js"));
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  await new Promise((resolve) => fakeService.close(resolve));
  delete process.env.SENTIMENT_SERVICE_URL;
});

describe("content-hash sentiment cache (real Mongo + real HTTP service)", () => {
  it("scores via the service on a miss, then serves an identical document from cache without calling the service again", async () => {
    requestCount = 0;
    const doc = {
      title: "Reliance beats estimates on strong refining margins",
      source_type: "news"
    };

    const [first] = await scoreDocuments([doc]);
    expect(first.sentiment.model).toBe("fake/finbert");
    expect(first.sentiment.score).toBe(0.7);
    expect(requestCount).toBe(1);

    const [second] = await scoreDocuments([{ ...doc }]);
    expect(second.sentiment.model).toBe("fake/finbert");
    expect(second.sentiment.score).toBe(0.7);
    expect(requestCount).toBe(1); // no new HTTP call — served from the cache
  });

  it("does not share a cache entry across different asset classes for the same text", async () => {
    requestCount = 0;
    const text = "ETF inflows accelerate this week";

    await scoreDocuments([{ title: text, source_type: "news", primary_asset: "AAPL" }]);
    expect(requestCount).toBe(1);

    // BTC routes as crypto — a different cache key, so this must still call out.
    await scoreDocuments([{ title: text, source_type: "news", primary_asset: "BTC" }]);
    expect(requestCount).toBe(2);
  });

  it("treats a batch of duplicate texts as a single service call plus cache fills", async () => {
    requestCount = 0;
    const text = "Duplicate headline appearing in three connectors";
    const docs = [
      { title: text, source_type: "news" },
      { title: text, source_type: "news" },
      { title: text, source_type: "news" }
    ];

    const scored = await scoreDocuments(docs);
    expect(scored).toHaveLength(3);
    expect(scored.every((d) => d.sentiment.score === 0.7)).toBe(true);
    // All three shared one cache key, computed once, so they're either all in
    // the same single miss batch or (if a previous test warmed it) all hits —
    // either way, at most one HTTP round trip for this run.
    expect(requestCount).toBeLessThanOrEqual(1);
  });
});
