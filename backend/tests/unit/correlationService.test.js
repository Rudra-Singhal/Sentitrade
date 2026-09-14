const {
  buildInsight,
  classifyCoMovement,
  computeSentimentChange
} = require("../../src/services/correlationService");

describe("computeSentimentChange", () => {
  it("returns null with fewer than two points", () => {
    expect(computeSentimentChange([])).toBeNull();
    expect(computeSentimentChange([{ sentiment_avg: 0.2 }])).toBeNull();
  });

  it("is the difference of the endpoint sentiment percents", () => {
    // sentiment_avg 0 -> 50%, 0.2 -> 60%
    expect(computeSentimentChange([{ sentiment_avg: 0 }, { sentiment_avg: 0.2 }])).toBe(10);
    expect(computeSentimentChange([{ sentiment_avg: 0.2 }, { sentiment_avg: 0 }])).toBe(-10);
  });
});

describe("classifyCoMovement", () => {
  it("flat when either move is below threshold", () => {
    expect(classifyCoMovement(1, 5)).toMatch(/roughly flat/i);
    expect(classifyCoMovement(10, 0.01)).toMatch(/roughly flat/i);
  });
  it("same direction when both move enough the same way", () => {
    expect(classifyCoMovement(5, 2)).toMatch(/same direction/i);
    expect(classifyCoMovement(-5, -2)).toMatch(/same direction/i);
  });
  it("opposite direction when they diverge", () => {
    expect(classifyCoMovement(5, -2)).toMatch(/opposite directions/i);
    expect(classifyCoMovement(-5, 2)).toMatch(/opposite directions/i);
  });
});

const trend = (pcts, data_source = "live") => ({
  asset: "BTC",
  data_source,
  points: pcts.map((p) => ({ sentiment_avg: p / 50 - 1, sentiment_percent: p }))
});
const price = (over = {}) => ({
  data_source: "live",
  price_source: "live",
  price_change: 2.5,
  current_price: 100,
  series: [{}, {}],
  ...over
});

describe("buildInsight", () => {
  it("carries the not-predictive note and a combined data_source", () => {
    const r = buildInsight({
      trend: trend([40, 60]),
      price: price({ price_source: "cached" }),
      range: "1h"
    });
    expect(r.note).toMatch(/not a predictive correlation/i);
    expect(r.data_source).toBe("cached");
    expect(r.insight).toMatch(/same direction/i);
  });

  it("returns nulls + insufficient text when price is unavailable", () => {
    const r = buildInsight({
      trend: trend([40, 60]),
      price: price({
        price_source: "unavailable",
        price_change: null,
        current_price: null,
        series: []
      })
    });
    expect(r.price_change).toBeNull();
    expect(r.current_price).toBeNull();
    expect(r.insight).toMatch(/not enough live data/i);
    expect(r.data_source).toBe("unavailable");
  });

  it("returns nulls when the trend has too few points", () => {
    const r = buildInsight({ trend: trend([55]), price: price() });
    expect(r.sentiment_change).toBeNull();
    expect(r.insight).toMatch(/not enough live data/i);
  });

  it("still computes on simulated data (dev/demo), tagged simulated", () => {
    const r = buildInsight({
      trend: trend([40, 60], "simulated"),
      price: price({ data_source: "simulated", price_source: "simulated" })
    });
    expect(r.data_source).toBe("simulated");
    expect(r.insight).toMatch(/same direction/i);
  });
});
