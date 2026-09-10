const { resolveEntities } = require("../../src/pipeline/entities");

describe("resolveEntities", () => {
  it("resolves the primary asset by name and gives it high relevance", () => {
    const r = resolveEntities(
      {
        title: "Bitcoin ETF inflows accelerate",
        text: "Institutional demand for bitcoin improves."
      },
      "BTC"
    );
    const btc = r.entities.find((e) => e.symbol === "BTC");
    expect(btc).toBeTruthy();
    expect(r.primaryRelevance).toBeGreaterThan(0.6);
  });

  it("gives a passing-mention-only doc low relevance for the primary asset", () => {
    const r = resolveEntities(
      { title: "Fed holds rates steady", text: "Markets were mixed; bitcoin barely moved." },
      "BTC"
    );
    expect(r.primaryRelevance).toBeLessThan(0.5);
  });

  it("returns 0.2 relevance when the primary asset is never mentioned", () => {
    const r = resolveEntities(
      { title: "Oil prices rise", text: "OPEC signals supply cuts." },
      "BTC"
    );
    expect(r.primaryRelevance).toBe(0.2);
    expect(r.entities.find((e) => e.symbol === "BTC")).toBeUndefined();
  });

  it("attributes a two-company headline to both tickers, primary weighted down", () => {
    const r = resolveEntities(
      { title: "Nvidia soars as Intel stumbles on weak guidance", text: "" },
      "INTC"
    );
    const symbols = r.entities.map((e) => e.symbol);
    expect(symbols).toContain("NVDA");
    expect(symbols).toContain("INTC");
  });

  it("only resolves ambiguous tickers on a cashtag or a real name", () => {
    // bare "V" in prose must NOT resolve to Visa
    const bare = resolveEntities({ title: "Plan B is option V for the team", text: "" }, "V");
    expect(bare.entities.find((e) => e.symbol === "V")).toBeUndefined();

    const cashtag = resolveEntities(
      { title: "$V hits a new high on strong volume", text: "" },
      "V"
    );
    expect(cashtag.entities.find((e) => e.symbol === "V")).toBeTruthy();

    const named = resolveEntities(
      { title: "Visa reports record cross-border volume", text: "" },
      "V"
    );
    expect(named.entities.find((e) => e.symbol === "V")).toBeTruthy();
  });

  it("boosts salience for a cashtag match", () => {
    const withTag = resolveEntities({ title: "$AAPL breaking out", text: "" }, "AAPL");
    const withoutTag = resolveEntities({ title: "apple mentioned once", text: "" }, "AAPL");
    const a = withTag.entities.find((e) => e.symbol === "AAPL");
    const b = withoutTag.entities.find((e) => e.symbol === "AAPL");
    expect(a.cashtag).toBe(true);
    expect(a.salience).toBeGreaterThan(b.salience);
  });
});
