const stocktwits = require("../../src/connectors/stocktwits");
const { scoreDocument } = require("../../src/pipeline/score");
const { normalizeAsset } = require("../../src/services/assetService");

describe("stocktwits connector", () => {
  it("suffixes crypto cashtags with .X and leaves equities plain", () => {
    expect(stocktwits.stocktwitsSymbol(normalizeAsset("BTC"))).toBe("BTC.X");
    expect(stocktwits.stocktwitsSymbol(normalizeAsset("AAPL"))).toBe("AAPL");
  });

  it("mapMessages maps body/author/native-sentiment and applies the window", () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const messages = [
      {
        id: 1,
        body: "$BTC looks strong here, loading up",
        created_at: now,
        user: { username: "trader_x", followers: 500 },
        entities: { sentiment: { basic: "Bullish" } },
        symbols: [{ symbol: "BTC.X" }]
      },
      { id: 2, body: "old post", created_at: old, user: { username: "y" } }
    ];
    const docs = stocktwits.mapMessages(messages, Date.now() - 24 * 3600 * 1000, 30);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      text: "$BTC looks strong here, loading up",
      author_handle: "trader_x",
      author_followers: 500,
      native_sentiment: "Bullish"
    });
    expect(docs[0].provider_meta.source_name).toBe("StockTwits");
  });
});

describe("score with a platform-native label", () => {
  it("uses Bullish/Bearish instead of VADER when present", () => {
    const bull = scoreDocument({
      title: "",
      text: "chart looks bad but whatever",
      source: "stocktwits",
      provider_meta: { native_sentiment: "Bullish" }
    });
    expect(bull.sentiment.model).toBe("platform_native");
    expect(bull.sentiment.label).toBe("positive");

    const bear = scoreDocument({
      title: "",
      text: "great company",
      source: "stocktwits",
      provider_meta: { native_sentiment: "Bearish" }
    });
    expect(bear.sentiment.label).toBe("negative");
  });

  it("falls back to VADER without a native label", () => {
    const d = scoreDocument({
      title: "Company reports strong profit growth",
      text: "",
      provider_meta: {}
    });
    expect(d.sentiment.model).toBe("vader");
  });
});
