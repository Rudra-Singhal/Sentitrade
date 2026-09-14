const { cleanText, cacheKey, getMany, setMany } = require("../../src/pipeline/sentimentCache");

describe("sentimentCache.cleanText", () => {
  it("collapses whitespace and lowercases", () => {
    expect(cleanText("  Bitcoin   Rallies\nHard  ")).toBe("bitcoin rallies hard");
  });

  it("handles missing text", () => {
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(null)).toBe("");
  });
});

describe("sentimentCache.cacheKey", () => {
  it("is stable for the same text and route", () => {
    const a = cacheKey("Profits beat estimates", "news", "equity");
    const b = cacheKey("Profits beat estimates", "news", "equity");
    expect(a).toBe(b);
  });

  it("is insensitive to whitespace/case differences that don't change meaning", () => {
    const a = cacheKey("Profits beat estimates", "news", "equity");
    const b = cacheKey("  PROFITS   beat  estimates  ", "news", "equity");
    expect(a).toBe(b);
  });

  it("differs when the route differs, even for identical text", () => {
    // The same headline must not share a cache entry across routes: crypto
    // news and equity news are scored by different models.
    const equity = cacheKey("ETF inflows accelerate", "news", "equity");
    const crypto = cacheKey("ETF inflows accelerate", "news", "crypto");
    expect(equity).not.toBe(crypto);
  });

  it("differs when the text differs", () => {
    const a = cacheKey("Profits beat estimates", "news", "equity");
    const b = cacheKey("Profits missed estimates", "news", "equity");
    expect(a).not.toBe(b);
  });
});

// No MongoDB is connected in the unit-test process — these confirm the module
// degrades to a safe no-op rather than throwing, the same contract every other
// optional dependency in this pipeline follows.
describe("sentimentCache without a database connection", () => {
  it("getMany returns an empty map instead of throwing", async () => {
    const hits = await getMany(["some-key"]);
    expect(hits.size).toBe(0);
  });

  it("getMany on an empty key list is a no-op", async () => {
    expect((await getMany([])).size).toBe(0);
  });

  it("setMany does not throw with no database", async () => {
    await expect(
      setMany([
        {
          key: "k",
          score: 0.5,
          label: "positive",
          confidence: null,
          model: "x",
          model_version: "1"
        }
      ])
    ).resolves.not.toThrow();
  });

  it("setMany on an empty list is a no-op", async () => {
    await expect(setMany([])).resolves.not.toThrow();
  });
});
