const { scoreDocuments, scoreDocument, MODEL } = require("../../src/pipeline/score");

// SENTIMENT_SERVICE_URL is unset in the test env, so these exercise the
// fallback path — the one that must keep working when the service is absent,
// which is also its state on a fresh checkout and on the free-tier deploy.
describe("scoreDocuments (no sentiment service configured)", () => {
  it("scores every document in-process and preserves order", async () => {
    const docs = [
      { text: "Profits surged past expectations", source_type: "news", asset: "AAPL" },
      { text: "A disastrous collapse wiped out holders", source_type: "news", asset: "AAPL" }
    ];

    const scored = await scoreDocuments(docs);

    expect(scored).toHaveLength(2);
    expect(scored[0].sentiment.score).toBeGreaterThan(0);
    expect(scored[1].sentiment.score).toBeLessThan(0);
    expect(scored[0].sentiment.model).toBe(MODEL);
  });

  it("prefers a platform's own label over any model", async () => {
    const [scored] = await scoreDocuments([
      {
        text: "chart looks rough honestly",
        source_type: "social",
        provider_meta: { native_sentiment: "Bullish" }
      }
    ]);

    // The text reads negative; StockTwits' own Bullish tag wins anyway.
    expect(scored.sentiment.model).toBe("platform_native");
    expect(scored.sentiment.score).toBe(0.5);
    expect(scored.sentiment.label).toBe("positive");
  });

  it("handles a mixed batch of native-labelled and model-scored documents", async () => {
    const scored = await scoreDocuments([
      { text: "terrible quarter", source_type: "news" },
      { text: "anything", source_type: "social", provider_meta: { native_sentiment: "Bearish" } },
      { text: "excellent results, record profit", source_type: "news" }
    ]);

    expect(scored.map((d) => d.sentiment.model)).toEqual([MODEL, "platform_native", MODEL]);
    expect(scored[1].sentiment.score).toBe(-0.5);
    expect(scored[2].sentiment.score).toBeGreaterThan(0);
  });

  it("returns an empty array for an empty batch without calling out", async () => {
    expect(await scoreDocuments([])).toEqual([]);
    expect(await scoreDocuments()).toEqual([]);
  });

  it("still scores a document with no usable text", async () => {
    const [scored] = await scoreDocuments([{ text: "", source_type: "news" }]);
    expect(scored.sentiment).toBeDefined();
    expect(scored.sentiment.model).toBe(MODEL);
  });

  it("matches the synchronous scorer for the same input", async () => {
    const doc = { text: "Guidance raised on strong demand", source_type: "news" };
    const [batched] = await scoreDocuments([doc]);
    const single = scoreDocument(doc);
    expect(batched.sentiment.score).toBe(single.sentiment.score);
    expect(batched.sentiment.label).toBe(single.sentiment.label);
  });
});
