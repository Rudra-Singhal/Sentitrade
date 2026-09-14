import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ioClient } from "socket.io-client";

process.env.NODE_ENV = "test";

let mongod;
let server;
let url;
let io;
let RawDocument;

const seedDoc = (asset, text) => ({
  source: "newsapi",
  source_type: "news",
  dedupe_key: `s-${asset}-${Math.random()}`,
  text,
  title: text,
  primary_asset: asset,
  assets: [asset],
  published_at: new Date(),
  ingested_at: new Date(),
  sentiment: {
    score: 0.5,
    label: "positive",
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
    seedDoc("BTC", "Bitcoin demand improves, investors optimistic"),
    seedDoc("ETH", "Ethereum network upgrade lands successfully")
  ]);

  const initSocket = (await import("../../src/services/socketService.js")).default;
  server = http.createServer();
  io = initSocket(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
}, 60000);

afterAll(async () => {
  io.stopBroadcast?.();
  await io.close();
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

// Buffer every sentiment:update from the moment the socket exists, so tests
// never race the (sometimes cache-fast) server emit.
const connect = () =>
  new Promise((resolve) => {
    const c = ioClient(url, { transports: ["websocket"], reconnection: false });
    c._buf = [];
    c._waiters = [];
    c.on("sentiment:update", (p) => {
      const w = c._waiters.shift();
      if (w) w(p);
      else c._buf.push(p);
    });
    c.on("connect", () => resolve(c));
  });

const nextUpdate = (client) =>
  new Promise((resolve, reject) => {
    if (client._buf.length) return resolve(client._buf.shift());
    const t = setTimeout(() => reject(new Error("no sentiment:update")), 4000);
    client._waiters.push((p) => {
      clearTimeout(t);
      resolve(p);
    });
  });

describe("socket rooms", () => {
  it("sends a snapshot on connect for the default asset", async () => {
    const client = await connect();
    const payload = await nextUpdate(client);
    expect(payload.sentiment.asset).toBe("BTC");
    expect(payload.correlation).toHaveProperty("insight");
    expect(payload.sentiment).toHaveProperty("signal");
    client.close();
  });

  it("switches rooms and delivers the new asset on asset:change", async () => {
    const client = await connect();
    await nextUpdate(client); // initial BTC
    client.emit("asset:change", { asset: "ETH", range: "1h" });
    const payload = await nextUpdate(client);
    expect(payload.sentiment.asset).toBe("ETH");
    client.close();
  });

  it("rejects an invalid asset:change payload", async () => {
    const client = await connect();
    await nextUpdate(client);
    const err = await new Promise((resolve) => {
      client.once("sentiment:error", resolve);
      client.emit("asset:change", { asset: "DROP TABLE" });
    });
    expect(err).toMatch(/invalid/i);
    client.close();
  });

  it("delivers one room emit to every client in that room (fan-out)", async () => {
    const [a, b] = await Promise.all([connect(), connect()]);
    await Promise.all([nextUpdate(a), nextUpdate(b)]); // drain initial snapshots

    const both = Promise.all([nextUpdate(a), nextUpdate(b)]);
    io.to("BTC:1h").emit("sentiment:update", { sentiment: { asset: "BTC" }, correlation: {} });

    const [pa, pb] = await both;
    expect(pa.sentiment.asset).toBe("BTC");
    expect(pb.sentiment.asset).toBe("BTC");
    a.close();
    b.close();
  });
});
