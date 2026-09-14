const { normalizeAsset, listAssets } = require("../../src/services/assetService");

describe("normalizeAsset", () => {
  it("resolves known symbols case-insensitively with whitespace", () => {
    expect(normalizeAsset("btc").symbol).toBe("BTC");
    expect(normalizeAsset("  eth ").symbol).toBe("ETH");
    expect(normalizeAsset("AAPL").type).toBe("stock");
  });

  it("falls back to BTC for unknown or bad input", () => {
    expect(normalizeAsset("DOGE").symbol).toBe("BTC");
    expect(normalizeAsset("").symbol).toBe("BTC");
    expect(normalizeAsset(undefined).symbol).toBe("BTC");
    expect(normalizeAsset(null).symbol).toBe("BTC");
    expect(normalizeAsset(123).symbol).toBe("BTC");
  });
});

describe("listAssets", () => {
  it("returns a non-empty list with the required display fields", () => {
    const assets = listAssets();
    expect(assets.length).toBeGreaterThan(0);
    for (const a of assets) {
      expect(a).toHaveProperty("symbol");
      expect(a).toHaveProperty("displayName");
      expect(["crypto", "stock"]).toContain(a.type);
    }
  });
});
