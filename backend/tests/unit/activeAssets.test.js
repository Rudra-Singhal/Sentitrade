const activeAssets = require("../../src/jobs/activeAssets");

beforeEach(() => activeAssets._reset());

describe("activeAssets", () => {
  it("always includes the seed assets", () => {
    expect(activeAssets.list().sort()).toEqual([...activeAssets.SEED].sort());
  });

  it("adds tracked assets and removes them when the ref count hits zero", () => {
    activeAssets.track("nvda");
    activeAssets.track("NVDA");
    expect(activeAssets.list()).toContain("NVDA");

    activeAssets.untrack("NVDA");
    expect(activeAssets.list()).toContain("NVDA"); // still one ref

    activeAssets.untrack("NVDA");
    expect(activeAssets.list()).not.toContain("NVDA");
  });

  it("never lets the list contain duplicates", () => {
    activeAssets.track("BTC"); // already a seed
    const list = activeAssets.list();
    expect(new Set(list).size).toBe(list.length);
  });

  it("normalizes unknown assets to BTC", () => {
    activeAssets.track("NOTACOIN");
    expect(activeAssets.list()).toContain("BTC");
  });
});
