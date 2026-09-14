const { simhash, hamming } = require("../../src/lib/simhash");
const { jaccard, isRewordedDuplicate } = require("../../src/lib/textSimilarity");
const { weightForSource } = require("../../src/config/sources");

describe("simhash", () => {
  it("is a 16-char hex string", () => {
    expect(simhash("Bitcoin ETF inflows accelerate")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is identical for identical text", () => {
    const a = simhash("Apple beats on services revenue growth");
    const b = simhash("Apple beats on services revenue growth");
    expect(a).toBe(b);
    expect(hamming(a, b)).toBe(0);
  });

  it("handles empty text", () => {
    expect(simhash("")).toBe("0000000000000000");
    expect(simhash(null)).toBe("0000000000000000");
  });
});

describe("textSimilarity", () => {
  it("scores a reworded version of the same story as a duplicate", () => {
    const a = "Bitcoin spot ETF inflows accelerate as institutional demand improves further";
    const b = "Bitcoin ETF inflows accelerate on further improvement in institutional demand";
    expect(jaccard(a, b)).toBeGreaterThan(0.6);
    expect(isRewordedDuplicate(a, b)).toBe(true);
  });

  it("keeps unrelated finance headlines apart", () => {
    const a = "Bitcoin ETF inflows accelerate as demand improves";
    const b = "Federal Reserve holds interest rates steady amid inflation concerns";
    expect(isRewordedDuplicate(a, b)).toBe(false);
  });

  it("does not over-collapse two different Apple stories", () => {
    const a = "Apple services revenue hits a record in the quarter";
    const b = "Apple faces EU antitrust scrutiny over App Store rules";
    expect(isRewordedDuplicate(a, b)).toBe(false);
  });
});

describe("weightForSource", () => {
  it("weights wire services above aggregators and social", () => {
    expect(weightForSource("Reuters")).toBeGreaterThan(weightForSource("NewsAPI"));
    expect(weightForSource("CoinDesk")).toBeGreaterThan(weightForSource("reddit"));
  });
  it("falls back to a default for unknown sources", () => {
    expect(weightForSource("Some Random Blog")).toBe(0.5);
    expect(weightForSource(undefined)).toBe(0.5);
  });
});
