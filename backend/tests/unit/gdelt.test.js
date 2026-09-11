const gdelt = require("../../src/connectors/gdelt");
const { normalizeAsset } = require("../../src/services/assetService");

describe("gdelt connector", () => {
  it("is enabled with no key and builds an english-language query", () => {
    expect(gdelt.enabled).toBe(true);
    const q = gdelt.buildQuery(normalizeAsset("RELIANCE"));
    expect(q).toMatch(/sourcelang:english/);
    expect(q.toLowerCase()).toMatch(/reliance/);
  });

  it("mapArticles parses seendate, filters the window, caps the limit", () => {
    const now = new Date();
    const stamp = (d) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z")
        .replace("T", "T");
    const articles = [
      {
        title: "Reliance Q3 profit rises",
        url: "https://x/1",
        seendate: stamp(now),
        domain: "livemint.com",
        sourcecountry: "India"
      },
      { title: "Old story", url: "https://x/2", seendate: "20200101T000000Z", domain: "x.com" },
      { title: "", url: "https://x/3", seendate: stamp(now) }
    ];
    const docs = gdelt.mapArticles(articles, Date.now() - 3 * 24 * 3600 * 1000, 25);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ title: "Reliance Q3 profit rises" });
    expect(docs[0].provider_meta.source_name).toBe("livemint.com");
    expect(new Date(docs[0].published_at).getUTCFullYear()).toBe(now.getUTCFullYear());
  });

  it("mapArticles tolerates junk", () => {
    expect(gdelt.mapArticles(undefined, 0, 10)).toEqual([]);
  });
});
