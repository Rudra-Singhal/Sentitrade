const edgar = require("../../src/connectors/edgar");
const { normalizeAsset } = require("../../src/services/assetService");

describe("edgar connector", () => {
  it("only applies to equities in the CIK map", () => {
    expect(edgar.appliesTo(normalizeAsset("AAPL"))).toBe(true);
    expect(edgar.appliesTo(normalizeAsset("BTC"))).toBe(false);
  });

  it("eventFor decodes 8-K items and periodic reports", () => {
    expect(edgar.eventFor("8-K", "2.02,9.01")).toEqual({ type: "earnings", impact: 0.8 });
    expect(edgar.eventFor("8-K", "5.02")).toEqual({ type: "executive_change", impact: 0.6 });
    expect(edgar.eventFor("8-K", "7.01")).toEqual({ type: "disclosure", impact: 0.3 });
    expect(edgar.eventFor("10-K").type).toBe("annual_report");
    expect(edgar.eventFor("4").type).toBe("insider_transaction");
  });

  it("mapFilings keeps only tracked forms in the window and attaches an event", () => {
    const today = new Date().toISOString().slice(0, 10);
    const recent = {
      form: ["8-K", "S-8", "10-Q", "4"],
      filingDate: [today, today, today, "2000-01-01"],
      items: ["2.02", "", "", ""],
      accessionNumber: [
        "0000320193-26-000001",
        "x",
        "0000320193-26-000002",
        "0000320193-00-000003"
      ],
      primaryDocument: ["a.htm", "b.htm", "c.htm", "d.htm"]
    };
    const docs = edgar.mapFilings(recent, "Apple", Date.now() - 30 * 86400 * 1000, 15);
    // 8-K + 10-Q kept; S-8 not tracked; the year-2000 Form 4 is outside the window
    expect(docs.map((d) => d.provider_meta.form).sort()).toEqual(["10-Q", "8-K"]);
    const eightK = docs.find((d) => d.provider_meta.form === "8-K");
    expect(eightK.event).toEqual({ type: "earnings", impact: 0.8 });
    expect(eightK.text).toMatch(/Apple filed a 8-K/);
    expect(eightK.text).toMatch(/earnings/i);
  });
});
