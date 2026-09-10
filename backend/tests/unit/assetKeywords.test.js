const { normalizeAsset, keywordsFor, mentionsAsset } = require("../../src/services/assetService");

describe("keywordsFor", () => {
  it("includes symbol, display name and aliases, lowercased and unique", () => {
    const kw = keywordsFor(normalizeAsset("BTC"));
    expect(kw).toContain("btc");
    expect(kw).toContain("bitcoin");
    expect(new Set(kw).size).toBe(kw.length);
  });
});

describe("mentionsAsset", () => {
  const btc = normalizeAsset("BTC");
  const eth = normalizeAsset("ETH");

  it("matches on whole-word aliases", () => {
    expect(mentionsAsset("Bitcoin ETF inflows accelerate", btc)).toBe(true);
    expect(mentionsAsset("BTC breaks resistance", btc)).toBe(true);
    expect(mentionsAsset("Ethereum staking hits a record", eth)).toBe(true);
  });

  it("does not match unrelated text or substrings", () => {
    expect(mentionsAsset("Apple earnings beat expectations", btc)).toBe(false);
    expect(mentionsAsset("the arbitrageur watched closely", btc)).toBe(false); // no 'btc' substring hit
    expect(mentionsAsset("", btc)).toBe(false);
  });
});
