const { generateTradeSignal } = require("../../src/services/signalService");

const items = (n, label) => Array.from({ length: n }, () => ({ sentiment_label: label }));

const sentiment = (over = {}) => ({
  data_source: "live",
  score_percent: 50,
  items: items(10, "neutral"),
  ...over
});

const correlation = (over = {}) => ({
  data_source: "live",
  sentiment_change: 0,
  price_change: 0,
  ...over
});

describe("generateTradeSignal — data availability", () => {
  it("returns an insufficient-data HOLD when sentiment is unavailable", () => {
    const s = generateTradeSignal({
      sentiment: { data_source: "unavailable", items: [] },
      correlation: correlation()
    });
    expect(s.signal).toBe("HOLD");
    expect(s.strength).toBe("low");
    expect(s.data_source).toBe("unavailable");
    expect(s).not.toHaveProperty("confidence");
  });

  it("computes on simulated data (dev/demo) but keeps the label", () => {
    const s = generateTradeSignal({
      sentiment: sentiment({
        data_source: "simulated",
        score_percent: 80,
        items: items(12, "positive")
      }),
      correlation: correlation({ data_source: "simulated", sentiment_change: 10, price_change: 2 })
    });
    expect(s.data_source).toBe("simulated");
    expect(s.signal).toBe("BUY");
  });

  it("falls back to news-only when price/correlation is unavailable", () => {
    const s = generateTradeSignal({
      sentiment: sentiment({ score_percent: 80, items: items(12, "positive") }),
      correlation: { data_source: "unavailable", sentiment_change: null, price_change: null }
    });
    expect(s.price_considered).toBe(false);
    expect(s.reasons.join(" ")).toMatch(/price data is unavailable/i);
  });
});

describe("generateTradeSignal — thresholds", () => {
  it("BUY at score >= 4", () => {
    const s = generateTradeSignal({
      sentiment: sentiment({ score_percent: 70, items: items(10, "positive") }),
      correlation: correlation({ sentiment_change: 9, price_change: 1 })
    });
    expect(s.score).toBeGreaterThanOrEqual(4);
    expect(s.signal).toBe("BUY");
    expect(s.tone).toBe("bullish");
  });

  it("SELL at score <= -4", () => {
    const s = generateTradeSignal({
      sentiment: sentiment({ score_percent: 30, items: items(10, "negative") }),
      correlation: correlation({ sentiment_change: -9, price_change: -1 })
    });
    expect(s.score).toBeLessThanOrEqual(-4);
    expect(s.signal).toBe("SELL");
    expect(s.tone).toBe("bearish");
  });

  it("HOLD in the mixed middle", () => {
    const s = generateTradeSignal({
      sentiment: sentiment({ score_percent: 52, items: items(10, "neutral") }),
      correlation: correlation()
    });
    expect(s.signal).toBe("HOLD");
  });

  it("strength scales with |score| and is never a number", () => {
    const strong = generateTradeSignal({
      sentiment: sentiment({ score_percent: 90, items: items(20, "positive") }),
      correlation: correlation({ sentiment_change: 12, price_change: 3 })
    });
    expect(["low", "moderate", "high"]).toContain(strong.strength);
    expect(typeof strong.strength).toBe("string");
  });

  it("always includes the not-advice disclaimer and caps reasons at 4", () => {
    const s = generateTradeSignal({ sentiment: sentiment(), correlation: correlation() });
    expect(s.disclaimer).toMatch(/not investment advice/i);
    expect(s.reasons.length).toBeLessThanOrEqual(4);
  });
});
