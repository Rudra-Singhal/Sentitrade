const {
  normalizeAsset,
  listAssets,
  LIST,
  keywordsFor,
  mentionsAsset
} = require("../../src/services/assetService");

describe("normalizeAsset", () => {
  it("resolves crypto, US and NSE symbols case-insensitively", () => {
    expect(normalizeAsset("btc").type).toBe("crypto");
    expect(normalizeAsset("  aapl ").exchange).toBe("US");
    expect(normalizeAsset("reliance").exchange).toBe("NSE");
    expect(normalizeAsset("RELIANCE").yahooSymbol).toBe("RELIANCE.NS");
  });

  it("falls back to BTC for unknown or bad input", () => {
    expect(normalizeAsset("NOTACOIN").symbol).toBe("BTC");
    expect(normalizeAsset("").symbol).toBe("BTC");
    expect(normalizeAsset(undefined).symbol).toBe("BTC");
    expect(normalizeAsset(null).symbol).toBe("BTC");
    expect(normalizeAsset(123).symbol).toBe("BTC");
  });
});

describe("listAssets", () => {
  it("returns crypto + US + NSE entries with the display fields", () => {
    const assets = listAssets();
    expect(assets.length).toBeGreaterThan(60);
    expect(assets.some((a) => a.exchange === "NSE")).toBe(true);
    expect(assets.some((a) => a.exchange === "US")).toBe(true);
    expect(assets.some((a) => a.type === "crypto")).toBe(true);
    for (const a of assets) {
      expect(a).toHaveProperty("tradingViewSymbol");
      expect(a).toHaveProperty("exchange");
    }
  });

  it("every asset has a well-formed config", () => {
    for (const a of LIST) {
      expect(a.symbol).toMatch(/^[A-Z0-9&_]+$/);
      expect(a.query.length).toBeGreaterThan(3);
      if (a.type === "stock") expect(a.yahooSymbol).toBeTruthy();
      if (a.type === "crypto") expect(a.binanceSymbol).toMatch(/USDT$/);
    }
  });
});

describe("keywordsFor / mentionsAsset", () => {
  it("matches Indian company names and aliases", () => {
    const ril = normalizeAsset("RELIANCE");
    expect(keywordsFor(ril)).toEqual(expect.arrayContaining(["reliance industries", "jio"]));
    expect(mentionsAsset("Reliance Jio adds 3 million subscribers", ril)).toBe(true);
    expect(mentionsAsset("Apple ships new iPhone", ril)).toBe(false);
  });
});
