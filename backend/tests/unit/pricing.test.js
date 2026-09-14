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

  it("mapKlines carries open/high/low alongside close, for candlestick charts", () => {
    const now = Date.now();
    const rows = [[now - 60000, "100.111", "105.2", "98.4", "102.5", "10"]];
    const [point] = binance.mapKlines(rows, now - 120000);
    expect(point).toMatchObject({
      open: 100.11,
      high: 105.2,
      low: 98.4,
      close: 102.5,
      price: 102.5
    });
  });
});

describe("yahoo", () => {
  it("PLAN requests at least a 2-day window for intraday ranges, not 1", () => {
    // Regression: range:"1d" returns ZERO bars from Yahoo once the market has
    // been closed since Yahoo's own UTC day boundary — confirmed live against
    // TCS.NS (0 bars at range=1d, 50 at range=2d, identical request
    // otherwise). Every NSE price request was silently falling back to
    // simulated data outside a narrow UTC window because of this. Do not
    // shrink these back to "1d".
    expect(yahoo.PLAN["5m"].range).not.toBe("1d");
    expect(yahoo.PLAN["1h"].range).not.toBe("1d");
  });

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

  it("mapChart carries real open/high/low alongside close, for candlestick charts", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      chart: {
        result: [
          {
            timestamp: [now - 60],
            indicators: {
              quote: [{ close: [101.5], open: [99.2], high: [102.1], low: [98.75] }]
            }
          }
        ]
      }
    };
    const [point] = yahoo.mapChart(payload, (now - 300) * 1000);
    expect(point).toMatchObject({
      open: 99.2,
      high: 102.1,
      low: 98.75,
      close: 101.5,
      price: 101.5
    });
  });

  it("mapChart falls back to close for open/high/low when Yahoo omits them", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      chart: {
        result: [{ timestamp: [now - 60], indicators: { quote: [{ close: [50] }] } }]
      }
    };
    const [point] = yahoo.mapChart(payload, (now - 300) * 1000);
    expect(point).toMatchObject({ open: 50, high: 50, low: 50, close: 50 });
  });
});
