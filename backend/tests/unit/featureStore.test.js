const { aggregateDocs, MIN_DOCS } = require("../../src/pipeline/featureStore");

const NOW = new Date("2026-09-15T12:00:00.000Z").getTime();

const doc = (overrides = {}) => ({
  source_type: "news",
  source_weight: 0.5,
  published_at: new Date(NOW).toISOString(),
  sentiment: { score: 0, label: "neutral" },
  engagement: {},
  ...overrides
});

describe("featureStore.aggregateDocs — sparse handling", () => {
  it("returns unavailable-shaped output below the doc_count floor, never a computed number", () => {
    const docs = [doc(), doc()]; // 2 < MIN_DOCS
    const result = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(docs.length).toBeLessThan(MIN_DOCS);
    expect(result.sparse).toBe(true);
    expect(result.sentiment_weighted).toBeNull();
    expect(result.doc_count).toBe(2);
  });

  it("computes real numbers once the floor is met", () => {
    const docs = [doc(), doc(), doc()];
    const result = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(result.sparse).toBe(false);
    expect(result.sentiment_weighted).not.toBeNull();
  });
});

describe("featureStore.aggregateDocs — weighting", () => {
  it("weights a more credible source more heavily", () => {
    const docs = [
      doc({ sentiment: { score: 1, label: "positive" }, source_weight: 1.0 }), // Reuters-tier
      doc({ sentiment: { score: -1, label: "negative" }, source_weight: 0.1 }), // low-credibility
      doc({ sentiment: { score: 0, label: "neutral" }, source_weight: 0.5 })
    ];
    const { sentiment_weighted } = aggregateDocs(docs, { bucketEndMs: NOW });
    // The high-credibility positive source should pull the mean well above zero.
    expect(sentiment_weighted).toBeGreaterThan(0.2);
  });

  it("decays older documents toward less influence", () => {
    const fresh = doc({
      sentiment: { score: 1, label: "positive" },
      published_at: new Date(NOW).toISOString()
    });
    const stale = doc({
      sentiment: { score: -1, label: "negative" },
      published_at: new Date(NOW - 30 * 3_600_000).toISOString() // 30h old, well past the 6h half-life
    });
    const filler = [doc(), doc()]; // reach MIN_DOCS with neutral padding
    const { sentiment_weighted } = aggregateDocs([fresh, stale, ...filler], { bucketEndMs: NOW });
    // The fresh positive document should dominate a decayed-away negative one.
    expect(sentiment_weighted).toBeGreaterThan(0);
  });

  it("gives higher-engagement documents more weight", () => {
    const quiet = doc({ sentiment: { score: 1, label: "positive" }, engagement: {} });
    const viral = doc({
      sentiment: { score: -1, label: "negative" },
      engagement: { likes: 5000, shares: 800, comments: 300 }
    });
    const filler = [doc(), doc()];
    const { sentiment_weighted } = aggregateDocs([quiet, viral, ...filler], { bucketEndMs: NOW });
    // The viral negative post should outweigh the quiet positive one.
    expect(sentiment_weighted).toBeLessThan(0);
  });
});

describe("featureStore.aggregateDocs — robust aggregate", () => {
  it("trims extreme outliers out of a large-enough batch", () => {
    // 10 middling-positive docs and one wild negative outlier: 11 docs is
    // enough for floor(11 * 0.1) = 1 to actually trim one from each end.
    const middling = Array.from({ length: 10 }, () =>
      doc({ sentiment: { score: 0.3, label: "positive" } })
    );
    const outlier = doc({ sentiment: { score: -1, label: "negative" } });
    const { sentiment_weighted } = aggregateDocs([...middling, outlier], { bucketEndMs: NOW });
    // Trimmed mean should land back at 0.3 — the outlier is trimmed away.
    expect(sentiment_weighted).toBeCloseTo(0.3, 2);
  });

  it("does not trim a batch too small for a 10% cut to remove anything (untrimmed mean instead)", () => {
    // 9 docs: floor(9 * 0.1) = 0 — trimming has nothing to remove, so the
    // outlier legitimately still pulls the mean. This is the honest boundary,
    // not a bug: robust statistics need enough points to be robust.
    const middling = Array.from({ length: 8 }, () =>
      doc({ sentiment: { score: 0.3, label: "positive" } })
    );
    const outlier = doc({ sentiment: { score: -1, label: "negative" } });
    const { sentiment_weighted } = aggregateDocs([...middling, outlier], { bucketEndMs: NOW });
    expect(sentiment_weighted).toBeCloseTo((8 * 0.3 - 1) / 9, 3);
  });
});

describe("featureStore.aggregateDocs — bull/bear and breadth", () => {
  it("computes bull_bear_ratio and breadth from labels", () => {
    const docs = [
      doc({ sentiment: { score: 0.5, label: "positive" } }),
      doc({ sentiment: { score: 0.5, label: "positive" } }),
      doc({ sentiment: { score: -0.5, label: "negative" } })
    ];
    const result = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(result.bull_bear_ratio).toBe(2);
    expect(result.breadth).toBeCloseTo(1 / 3, 4);
  });
});

describe("featureStore.aggregateDocs — momentum (EWMA)", () => {
  it("seeds both EWMAs at the current mean with no prior bucket, giving zero momentum", () => {
    const docs = [doc(), doc(), doc()];
    const result = aggregateDocs(docs, { bucketEndMs: NOW, prevFeatures: null });
    expect(result.momentum).toBe(0);
    expect(result.sentiment_ewma_fast).toBe(result.sentiment_ewma_slow);
  });

  it("moves the fast EWMA toward a new mean faster than the slow one", () => {
    const positiveDocs = [
      doc({ sentiment: { score: 0.8, label: "positive" } }),
      doc({ sentiment: { score: 0.8, label: "positive" } }),
      doc({ sentiment: { score: 0.8, label: "positive" } })
    ];
    const prevFeatures = { sentiment_ewma_fast: 0, sentiment_ewma_slow: 0 };
    const result = aggregateDocs(positiveDocs, { bucketEndMs: NOW, prevFeatures });
    expect(result.sentiment_ewma_fast).toBeGreaterThan(result.sentiment_ewma_slow);
    expect(result.momentum).toBeGreaterThan(0);
  });
});

describe("featureStore.aggregateDocs — abnormal_volume_z", () => {
  it("is null without enough history to judge normal volume", () => {
    const docs = [doc(), doc(), doc()];
    expect(
      aggregateDocs(docs, { bucketEndMs: NOW, historicalCounts: [3, 4] }).abnormal_volume_z
    ).toBeNull();
  });

  it("flags a doc_count spike against a steady history", () => {
    const docs = Array.from({ length: 20 }, () => doc());
    const historicalCounts = [3, 4, 3, 4, 3, 4, 3, 4]; // steady baseline ~3.5
    const { abnormal_volume_z } = aggregateDocs(docs, { bucketEndMs: NOW, historicalCounts });
    expect(abnormal_volume_z).toBeGreaterThan(2); // 20 docs is a real spike vs. ~3.5 baseline
  });
});

describe("featureStore.aggregateDocs — news/retail divergence", () => {
  it("is null when only one side has documents", () => {
    const onlyNews = [doc(), doc(), doc()];
    expect(aggregateDocs(onlyNews, { bucketEndMs: NOW }).news_retail_divergence).toBeNull();
  });

  it("computes news mean minus social mean when both are present", () => {
    const docs = [
      doc({ source_type: "news", sentiment: { score: 0.8, label: "positive" } }),
      doc({ source_type: "social", sentiment: { score: -0.8, label: "negative" } }),
      doc({ source_type: "news", sentiment: { score: 0.6, label: "positive" } })
    ];
    const { news_retail_divergence } = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(news_retail_divergence).toBeGreaterThan(0); // news more positive than social here
  });
});

describe("featureStore.aggregateDocs — event flags", () => {
  it("collects distinct event types present in the window", () => {
    const docs = [
      doc(),
      doc({ event: { type: "earnings_beat" } }),
      doc({ event: { type: "earnings_beat" } }),
      doc({ event: { type: "guidance_cut" } })
    ];
    const { event_flags } = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(event_flags.sort()).toEqual(["earnings_beat", "guidance_cut"]);
  });
});

describe("featureStore.aggregateDocs — source breakdown", () => {
  it("counts every document by source_type, including unscored ones", () => {
    const docs = [
      doc({ source_type: "news" }),
      doc({ source_type: "social" }),
      doc({ source_type: "news" })
    ];
    const { source_breakdown } = aggregateDocs(docs, { bucketEndMs: NOW });
    expect(source_breakdown).toEqual({ news: 2, social: 1 });
  });
});
