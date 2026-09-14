const { sentimentQuery, trendQuery } = require("../../src/schemas/query");

describe("sentimentQuery", () => {
  it("applies defaults", () => {
    const r = sentimentQuery.parse({});
    expect(r).toMatchObject({ asset: "BTC", range: "1h", limit: 20, refresh: true });
  });

  it("uppercases asset and coerces limit", () => {
    const r = sentimentQuery.parse({ asset: "eth", limit: "5", refresh: "false" });
    expect(r.asset).toBe("ETH");
    expect(r.limit).toBe(5);
    expect(r.refresh).toBe(false);
  });

  it("rejects non-numeric limit", () => {
    expect(sentimentQuery.safeParse({ limit: "abc" }).success).toBe(false);
  });

  it("rejects out-of-range limit and bad range", () => {
    expect(sentimentQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(sentimentQuery.safeParse({ limit: "9999" }).success).toBe(false);
    expect(sentimentQuery.safeParse({ range: "99y" }).success).toBe(false);
  });

  it("rejects non-alphanumeric asset (injection-ish input)", () => {
    expect(sentimentQuery.safeParse({ asset: "DROP TABLE" }).success).toBe(false);
    expect(sentimentQuery.safeParse({ asset: "../etc" }).success).toBe(false);
  });

  it("rejects an alphanumeric asset that isn't in the tracked universe", () => {
    const result = sentimentQuery.safeParse({ asset: "XYZFAKE" });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/unknown asset/);
  });

  it("still accepts real tracked assets across all three markets", () => {
    expect(sentimentQuery.safeParse({ asset: "btc" }).success).toBe(true);
    expect(sentimentQuery.safeParse({ asset: "aapl" }).success).toBe(true);
    expect(sentimentQuery.safeParse({ asset: "reliance" }).success).toBe(true);
  });
});

describe("trendQuery", () => {
  it("accepts the three supported ranges only", () => {
    for (const range of ["5m", "1h", "24h"]) {
      expect(trendQuery.safeParse({ range }).success).toBe(true);
    }
    expect(trendQuery.safeParse({ range: "1w" }).success).toBe(false);
  });
});
