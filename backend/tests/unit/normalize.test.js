const { normalize, clampPublishedAt } = require("../../src/pipeline/normalize");
const { scoreDocument } = require("../../src/pipeline/score");

const connector = { id: "newsapi", sourceType: "news" };

describe("clampPublishedAt", () => {
  it("keeps a recent valid date", () => {
    const d = new Date(Date.now() - 3600_000);
    expect(clampPublishedAt(d.toISOString()).getTime()).toBe(d.getTime());
  });
  it("defaults invalid / missing to ~now", () => {
    expect(Math.abs(clampPublishedAt(undefined).getTime() - Date.now())).toBeLessThan(2000);
    expect(Math.abs(clampPublishedAt("not-a-date").getTime() - Date.now())).toBeLessThan(2000);
  });
  it("rejects far-future timestamps", () => {
    const future = new Date(Date.now() + 5 * 3600_000).toISOString();
    expect(clampPublishedAt(future).getTime()).toBeLessThanOrEqual(Date.now() + 2000);
  });
});

describe("normalize", () => {
  it("maps a connector doc to the canonical shape with a dedupe key", () => {
    const out = normalize(connector, "btc", {
      text: "Bitcoin ETF inflows accelerate",
      title: "Bitcoin ETF inflows accelerate",
      url: "https://x.com/a",
      published_at: new Date().toISOString(),
      provider_meta: { source_name: "CoinDesk" }
    });
    expect(out.source).toBe("newsapi");
    expect(out.source_type).toBe("news");
    expect(out.primary_asset).toBe("BTC");
    expect(out.assets).toEqual(["BTC"]);
    expect(out.dedupe_key).toMatch(/^[0-9a-f]{40}$/);
    expect(out.provider_meta.source_name).toBe("CoinDesk");
  });

  it("returns null for empty text", () => {
    expect(normalize(connector, "BTC", { text: "   " })).toBeNull();
    expect(normalize(connector, "BTC", {})).toBeNull();
  });
});

describe("scoreDocument", () => {
  it("attaches a sentiment block with model provenance", () => {
    const norm = normalize(connector, "BTC", {
      text: "Investors optimistic as profits rise strongly"
    });
    const scored = scoreDocument(norm);
    expect(scored.sentiment.model).toBe("vader");
    expect(scored.sentiment.label).toBe("positive");
    expect(typeof scored.sentiment.score).toBe("number");
    expect(scored.sentiment.scored_at).toBeInstanceOf(Date);
  });
});
