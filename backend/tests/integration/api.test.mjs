import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

process.env.NODE_ENV = "test";

let mongod;
let app;
let RawDocument;

const seed = (asset, text, score = 0.5) => ({
  source: "newsapi",
  source_type: "news",
  dedupe_key: `a-${asset}-${Math.random()}`,
  text,
  title: text,
  primary_asset: asset,
  assets: [asset],
  published_at: new Date(),
  ingested_at: new Date(),
  sentiment: {
    score,
    label: score > 0 ? "positive" : "negative",
    model: "vader",
    model_version: "x",
    scored_at: new Date()
  }
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  RawDocument = (await import("../../src/models/RawDocument.js")).default;
  await RawDocument.insertMany([
    seed("BTC", "Bitcoin demand improves and investors optimistic", 0.6),
    seed("BTC", "Bitcoin volatility climbs after liquidations", -0.3)
  ]);
  app = (await import("../../src/app.js")).default;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GET /api/health & /api/ready", () => {
  it("health is always ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("ready reports db + scheduler checks", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks).toHaveProperty("db", "ok");
    expect(res.body.checks).toHaveProperty("scheduler");
  });
});

describe("GET /api/assets", () => {
  it("returns the asset list", async () => {
    const res = await request(app).get("/api/assets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.assets)).toBe(true);
    expect(res.body.assets.length).toBeGreaterThan(0);
  });
});

describe("GET /api/sentiment", () => {
  it("returns a snapshot with a data_source and a signal", async () => {
    const res = await request(app).get("/api/sentiment?asset=BTC&range=1h");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ asset: "BTC" });
    expect(["live", "cached", "delayed", "simulated", "unavailable"]).toContain(
      res.body.data_source
    );
    expect(res.body.signal).toHaveProperty("strength");
    expect(res.body.signal).not.toHaveProperty("confidence");
    expect(res.body.signal.disclaimer).toMatch(/not investment advice/i);
    expect(res.headers["ratelimit-limit"]).toBeDefined();
  });

  it("rejects a malformed asset with 400", async () => {
    const res = await request(app).get("/api/sentiment?asset=DROP%20TABLE");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_query");
  });

  it("rejects a non-numeric limit with 400", async () => {
    const res = await request(app).get("/api/sentiment?asset=BTC&limit=abc");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sentiment/trend", () => {
  it("returns bucketed points for a stored asset", async () => {
    const res = await request(app).get("/api/sentiment/trend?asset=BTC&range=1h");
    expect(res.status).toBe(200);
    expect(res.body.asset).toBe("BTC");
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.data_source).toBe("live");
  });
});

describe("GET /api/correlation", () => {
  it("returns the co-movement insight + note", async () => {
    const res = await request(app).get("/api/correlation?asset=BTC&range=1h");
    expect(res.status).toBe(200);
    expect(res.body.note).toMatch(/not a predictive correlation/i);
    expect(res.body).toHaveProperty("insight");
    expect(res.body.signal).toHaveProperty("strength");
  });
});

describe("unknown routes", () => {
  it("404s with a json body", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found");
  });
});
