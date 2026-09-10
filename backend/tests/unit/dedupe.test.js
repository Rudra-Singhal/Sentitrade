const { normalizeText, dedupeKey } = require("../../src/lib/dedupe");

describe("normalizeText", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeText("Bitcoin ETF  Inflows  ACCELERATE!!!")).toBe(
      "bitcoin etf inflows accelerate"
    );
  });

  it("strips a trailing source attribution", () => {
    expect(normalizeText("Apple beats on services - Reuters")).toBe("apple beats on services");
    expect(normalizeText("Apple beats on services | CNBC")).toBe("apple beats on services");
  });

  it("removes URLs", () => {
    expect(normalizeText("Big news https://x.com/abc today")).toBe("big news today");
  });
});

describe("dedupeKey", () => {
  it("is stable across formatting noise and case", () => {
    const a = dedupeKey("BTC", "Bitcoin ETF inflows accelerate");
    const b = dedupeKey("btc", "  Bitcoin  ETF  inflows  accelerate!!  ");
    expect(a).toBe(b);
  });

  it("differs by asset for the same text", () => {
    expect(dedupeKey("BTC", "Crypto rallies")).not.toBe(dedupeKey("ETH", "Crypto rallies"));
  });

  it("is a 40-char hex sha1", () => {
    expect(dedupeKey("BTC", "x")).toMatch(/^[0-9a-f]{40}$/);
  });
});
