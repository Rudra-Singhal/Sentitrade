const {
  analyzeHeadline,
  averageSentiment,
  getSentimentLabel
} = require("../../src/services/sentimentService");

describe("getSentimentLabel", () => {
  it("uses the +/- 0.05 VADER thresholds", () => {
    expect(getSentimentLabel(0.05)).toBe("positive");
    expect(getSentimentLabel(0.0499)).toBe("neutral");
    expect(getSentimentLabel(-0.05)).toBe("negative");
    expect(getSentimentLabel(-0.0499)).toBe("neutral");
    expect(getSentimentLabel(0)).toBe("neutral");
  });
});

describe("analyzeHeadline", () => {
  it("scores a lexicon-friendly positive headline positive", () => {
    const r = analyzeHeadline("Investors are optimistic and happy as profits improve strongly");
    expect(r.sentiment_label).toBe("positive");
    expect(r.sentiment_score).toBeGreaterThan(0);
  });

  it("documents a known VADER weakness on financial phrasing", () => {
    // "crushes earnings" is unambiguously bullish in finance, but VADER's
    // general lexicon treats "crushes" as violent/negative. This is the core
    // reason a finance-specific model is planned (see V2_ROADMAP.md M3).
    const r = analyzeHeadline("Company crushes earnings estimates");
    expect(r.sentiment_label).not.toBe("positive");
  });

  it("handles empty / non-string input without throwing", () => {
    expect(analyzeHeadline("")).toEqual({ sentiment_score: 0, sentiment_label: "neutral" });
    expect(analyzeHeadline(undefined).sentiment_label).toBe("neutral");
    expect(analyzeHeadline(null).sentiment_label).toBe("neutral");
  });

  it("rounds score to 4 decimal places", () => {
    const r = analyzeHeadline("great good excellent wonderful");
    expect(Number.isFinite(r.sentiment_score)).toBe(true);
    expect(r.sentiment_score.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
  });
});

describe("averageSentiment", () => {
  it("returns neutral zero for empty input", () => {
    expect(averageSentiment([])).toEqual({ score: 0, scorePercent: 0, label: "neutral" });
    expect(averageSentiment()).toEqual({ score: 0, scorePercent: 0, label: "neutral" });
  });

  it("averages scores and maps to 0-100 percent", () => {
    const r = averageSentiment([{ sentiment_score: 1 }, { sentiment_score: -1 }]);
    expect(r.score).toBe(0);
    expect(r.scorePercent).toBe(50);
    expect(r.label).toBe("neutral");
  });

  it("maps a fully positive set near 100%", () => {
    const r = averageSentiment([{ sentiment_score: 1 }, { sentiment_score: 1 }]);
    expect(r.scorePercent).toBe(100);
    expect(r.label).toBe("positive");
  });
});
