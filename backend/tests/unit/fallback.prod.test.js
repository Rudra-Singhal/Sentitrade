// Must set NODE_ENV before requiring anything that reads config/env.
process.env.NODE_ENV = "production";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.CLIENT_URL = "https://example.com";
process.env.LOG_LEVEL = "silent";

const { syntheticOrNull } = require("../../src/lib/fallback");
const metrics = require("../../src/lib/metrics");

describe("syntheticOrNull in production", () => {
  it("refuses to fabricate and bumps the suppression counter", () => {
    const before = metrics.snapshot().counters.simulated_data_suppressed_total || 0;
    const result = syntheticOrNull("news", () => ["fake"]);
    expect(result).toBeNull();
    const after = metrics.snapshot().counters.simulated_data_suppressed_total || 0;
    expect(after).toBe(before + 1);
  });
});
