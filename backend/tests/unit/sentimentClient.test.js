const { mapResults } = require("../../src/services/sentimentClient");

// Per the project's established pattern: vitest can't reliably intercept CJS
// `require()` here, so the pure transformation is exported and tested directly
// rather than mocking the HTTP layer.
describe("sentimentClient.mapResults", () => {
  it("maps well-formed rows by id", () => {
    const byId = mapResults([
      {
        id: "0",
        score: 0.8123456,
        label: "positive",
        confidence: 0.94,
        model: "ProsusAI/finbert",
        model_version: "main",
        degraded: false
      }
    ]);

    expect(byId.get("0")).toEqual({
      score: 0.8123,
      label: "positive",
      confidence: 0.94,
      model: "ProsusAI/finbert",
      model_version: "main",
      degraded: false
    });
  });

  it("drops rows whose score is out of the [-1,1] contract", () => {
    const byId = mapResults([
      { id: "a", score: 4, label: "positive", model: "x", model_version: "1" },
      { id: "b", score: -9, label: "negative", model: "x", model_version: "1" },
      { id: "c", score: "not a number", label: "neutral", model: "x", model_version: "1" }
    ]);
    expect(byId.size).toBe(0);
  });

  it("drops rows with an unrecognised label rather than trusting them", () => {
    const byId = mapResults([
      { id: "a", score: 0.5, label: "bullish", model: "x", model_version: "1" }
    ]);
    expect(byId.size).toBe(0);
  });

  it("drops rows without a usable id", () => {
    expect(mapResults([{ score: 0.5, label: "positive" }]).size).toBe(0);
    expect(mapResults([{ id: 7, score: 0.5, label: "positive" }]).size).toBe(0);
  });

  it("normalises a missing confidence to null rather than 0", () => {
    // 0 would read as "the model was certain of nothing"; null means "this
    // scorer has no calibrated posterior to report" (VADER).
    const byId = mapResults([
      { id: "a", score: 0.2, label: "positive", model: "vader", model_version: "3.3.2" }
    ]);
    expect(byId.get("a").confidence).toBeNull();
  });

  it("survives a non-array payload", () => {
    expect(mapResults(undefined).size).toBe(0);
    expect(mapResults(null).size).toBe(0);
    expect(mapResults({ results: [] }).size).toBe(0);
  });

  it("keeps the degraded flag so honesty survives the hop", () => {
    const byId = mapResults([
      { id: "a", score: 0.1, label: "positive", model: "vader", model_version: "3.3.2", degraded: true }
    ]);
    expect(byId.get("a").degraded).toBe(true);
  });
});
