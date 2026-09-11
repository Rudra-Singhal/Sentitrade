const { DATA_SOURCE, worst, isReal, isUsable } = require("../../src/lib/dataSource");

describe("dataSource.worst", () => {
  it("returns the least-trustworthy label present", () => {
    expect(worst(DATA_SOURCE.LIVE, DATA_SOURCE.CACHED)).toBe(DATA_SOURCE.CACHED);
    expect(worst(DATA_SOURCE.LIVE, DATA_SOURCE.SIMULATED)).toBe(DATA_SOURCE.SIMULATED);
    expect(worst(DATA_SOURCE.CACHED, DATA_SOURCE.UNAVAILABLE)).toBe(DATA_SOURCE.UNAVAILABLE);
    expect(worst(DATA_SOURCE.LIVE, DATA_SOURCE.DELAYED)).toBe(DATA_SOURCE.DELAYED);
  });

  it("ignores null/undefined and defaults to unavailable when empty", () => {
    expect(worst(null, DATA_SOURCE.LIVE, undefined)).toBe(DATA_SOURCE.LIVE);
    expect(worst()).toBe(DATA_SOURCE.UNAVAILABLE);
    expect(worst(null, undefined)).toBe(DATA_SOURCE.UNAVAILABLE);
  });
});

describe("dataSource.isReal / isUsable", () => {
  it("isReal is true only for live/delayed/cached", () => {
    expect(isReal(DATA_SOURCE.LIVE)).toBe(true);
    expect(isReal(DATA_SOURCE.DELAYED)).toBe(true);
    expect(isReal(DATA_SOURCE.CACHED)).toBe(true);
    expect(isReal(DATA_SOURCE.SIMULATED)).toBe(false);
    expect(isReal(DATA_SOURCE.UNAVAILABLE)).toBe(false);
    expect(isReal(undefined)).toBe(false);
  });

  it("isUsable excludes only unavailable / missing", () => {
    expect(isUsable(DATA_SOURCE.SIMULATED)).toBe(true);
    expect(isUsable(DATA_SOURCE.LIVE)).toBe(true);
    expect(isUsable(DATA_SOURCE.UNAVAILABLE)).toBe(false);
    expect(isUsable(undefined)).toBe(false);
  });
});
