import { describe, it, expect } from "vitest";
import {
  DATA_SOURCE,
  worstSource,
  isRealSource,
  describeSource,
  formatAsOf
} from "./dataSource.js";

describe("worstSource", () => {
  it("returns the least-trustworthy present label", () => {
    expect(worstSource(DATA_SOURCE.LIVE, DATA_SOURCE.SIMULATED)).toBe(DATA_SOURCE.SIMULATED);
    expect(worstSource(DATA_SOURCE.LIVE, DATA_SOURCE.CACHED, null)).toBe(DATA_SOURCE.CACHED);
    expect(worstSource(null, undefined)).toBe(DATA_SOURCE.UNAVAILABLE);
  });
});

describe("isRealSource", () => {
  it("treats live/delayed/cached as real and simulated/unavailable as not", () => {
    expect(isRealSource("live")).toBe(true);
    expect(isRealSource("cached")).toBe(true);
    expect(isRealSource("simulated")).toBe(false);
    expect(isRealSource(undefined)).toBe(false);
  });
});

describe("describeSource", () => {
  it("maps each label to a tone + human text", () => {
    expect(describeSource("simulated")).toMatchObject({ text: "Simulated", tone: "warning" });
    expect(describeSource("unavailable").tone).toBe("danger");
    expect(describeSource("live").tone).toBe("positive");
  });
});

describe("formatAsOf", () => {
  it("renders relative ages and null for bad input", () => {
    expect(formatAsOf(new Date().toISOString())).toBe("just now");
    expect(formatAsOf(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m ago");
    expect(formatAsOf("nonsense")).toBeNull();
    expect(formatAsOf(null)).toBeNull();
  });
});
