const { normalizeAsset } = require("../../src/services/assetService");
const finnhub = require("../../src/connectors/finnhub");
const rss = require("../../src/connectors/rss");

describe("finnhub connector", () => {
  it("only applies to equities", () => {
    expect(finnhub.appliesTo(normalizeAsset("AAPL"))).toBe(true);
    expect(finnhub.appliesTo(normalizeAsset("BTC"))).toBe(false);
  });

  it("mapCompanyNews maps rows, drops empty headlines, respects the limit", () => {
    const rows = [
      {
        id: 1,
        headline: "Apple services revenue grows",
        url: "https://x/1",
        datetime: 1_700_000_000,
        source: "CNBC"
      },
      { id: 2, headline: "", url: "https://x/2", datetime: 1_700_000_100 },
      { id: 3, headline: "AAPL upgraded by analyst", url: "https://x/3", datetime: 1_700_000_200 }
    ];
    const docs = finnhub.mapCompanyNews(rows, 1);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      title: "Apple services revenue grows",
      external_id: "finnhub:1"
    });
    expect(docs[0].provider_meta.source_name).toBe("CNBC");
    expect(new Date(docs[0].published_at).getUTCFullYear()).toBe(2023);
  });

  it("mapCompanyNews tolerates non-array input", () => {
    expect(finnhub.mapCompanyNews(undefined)).toEqual([]);
    expect(finnhub.mapCompanyNews({ error: "nope" })).toEqual([]);
  });
});

describe("rss connector", () => {
  it("only applies to asset classes with configured feeds", () => {
    expect(rss.appliesTo(normalizeAsset("BTC"))).toBe(true);
    expect(rss.appliesTo(normalizeAsset("AAPL"))).toBe(false);
  });

  it("selectItems keeps only in-window items that mention the asset", () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    const feeds = [
      {
        feed: { name: "CoinDesk", url: "u" },
        items: [
          { title: "Bitcoin ETF inflows accelerate", link: "l1", isoDate: now },
          { title: "Ethereum upgrade ships", link: "l2", isoDate: now },
          { title: "Old Bitcoin story", link: "l3", isoDate: old }
        ]
      }
    ];
    const sinceMs = Date.now() - 24 * 3600 * 1000;
    const docs = rss.selectItems(feeds, normalizeAsset("BTC"), sinceMs, 20);
    const titles = docs.map((d) => d.title);
    expect(titles).toEqual(["Bitcoin ETF inflows accelerate"]);
    expect(docs[0].provider_meta.source_name).toBe("CoinDesk");
  });
});
