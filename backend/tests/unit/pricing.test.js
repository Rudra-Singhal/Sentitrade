const binance = require("../../src/pricing/binance");
const yahoo = require("../../src/pricing/yahoo");
const { providerFor } = require("../../src/pricing");
const { normalizeAsset } = require("../../src/services/assetService");

describe("pricing registry", () => {
  it("routes crypto to binance and equities to yahoo", () => {
    expect(providerFor(normalizeAsset("BTC")).id).toBe("binance");
    expect(providerFor(normalizeAsset("AAPL")).id).toBe("yahoo");
  });
});

describe("binance", () => {
  it("derives the trading pair from the tradingView symbol", () => {
    expect(binance.toBinanceSymbol(normalizeAsset("BTC"))).toBe("BTCUSDT");
    expect(binance.toBinanceSymbol({ symbol: "FOO", tradingViewSymbol: "BINANCE:FOOUSDT" })).toBe(
      "FOOUSDT"
    );
  });

  it("mapKlines keeps in-window rows and takes the close price", () => {
    const now = Date.now();
    const rows = [
      [now - 10 * 60000, "1", "2", "0.5", "1.5", "10"],
      [now - 1 * 60000, "1.5", "2", "1", "1.75", "12"]
    ];
    const series = binance.mapKlines(rows, now - 5 * 60000);
    expect(series).toHaveLength(1);
    expect(series[0].price).toBe(1.75);
  });

  it("mapKlines tolerates junk", () => {
    expect(binance.mapKlines(null, 0)).toEqual([]);
    expect(binance.mapKlines([{ not: "an array" }], 0)).toEqual([]);
  });
});

describe("yahoo", () => {
  it("mapChart pairs timestamps with closes and drops nulls / out-of-window", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      chart: {
        result: [
          {
            timestamp: [now - 600, now - 300, now - 60],
            indicators: { quote: [{ close: [100, null, 101.5] }] }
          }
        ]
      }
    };
    // window keeps only the last point; < 2 in-window -> fall back to the tail
    const series = yahoo.mapChart(payload, (now - 400) * 1000);
    expect(series.map((p) => p.price)).toEqual([100, 101.5]); // nulls dropped, tail kept
  });

  it("filters to the window when there is enough in-window data", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      chart: {
        result: [
          {
            timestamp: [now - 900, now - 600, now - 120, now - 60],
            indicators: { quote: [{ close: [10, 11, 12, 13] }] }
          }
        ]
      }
    };
    const series = yahoo.mapChart(payload, (now - 300) * 1000);
    expect(series.map((p) => p.price)).toEqual([12, 13]);
  });

  it("mapChart returns [] for an error payload", () => {
    expect(yahoo.mapChart({ chart: { result: null, error: "x" } }, 0)).toEqual([]);
  });
});
