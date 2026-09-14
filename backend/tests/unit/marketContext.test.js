const {
  parseCryptoFng,
  parseEquityFng,
  computeAttention,
  getAttention
} = require("../../src/services/marketContextService");

describe("fear & greed parsers", () => {
  it("parses the alternative.me crypto payload", () => {
    const r = parseCryptoFng({ data: [{ value: "72", value_classification: "Greed" }] });
    expect(r).toMatchObject({ value: 72, label: "Greed", source: "alternative.me" });
  });

  it("parses the CNN equity payload and rounds the score", () => {
    const r = parseEquityFng({ fear_and_greed: { score: 41.6, rating: "Fear" } });
    expect(r).toMatchObject({ value: 42, label: "Fear", source: "CNN" });
  });

  it("returns null for empty payloads", () => {
    expect(parseCryptoFng({})).toBeNull();
    expect(parseEquityFng(undefined)).toBeNull();
  });
});

describe("computeAttention", () => {
  it("is the latest day vs the trailing baseline", () => {
    const r = computeAttention([
      { views: 100 },
      { views: 100 },
      { views: 100 },
      { views: 100 },
      { views: 300 }
    ]);
    expect(r.ratio).toBe(3);
    expect(r.source).toBe("Wikipedia");
  });

  it("needs at least four days of data", () => {
    expect(computeAttention([{ views: 1 }, { views: 2 }])).toBeNull();
    expect(computeAttention([])).toBeNull();
  });
});

describe("getAttention", () => {
  it("returns null for an asset with no Wikipedia article mapping", async () => {
    expect(await getAttention("ZZZZ")).toBeNull();
  });
});
