import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// lightweight-charts needs a real canvas, which jsdom doesn't have — mock the
// chart/series objects and assert on how PriceChart drives them instead of
// what gets drawn. Matches this project's established pattern of testing the
// logic at the boundary rather than fighting an environment limitation.
const series = { setData: vi.fn() };
const chart = {
  addCandlestickSeries: vi.fn(() => series),
  addLineSeries: vi.fn(() => series),
  removeSeries: vi.fn(),
  applyOptions: vi.fn(),
  timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
  remove: vi.fn()
};
vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(() => chart),
  ColorType: { Solid: "solid" }
}));

const api = vi.hoisted(() => ({ fetchPrice: vi.fn() }));
vi.mock("../services/api.js", () => api);

const { default: PriceChart } = await import("./PriceChart.jsx");

const ohlcPoint = (overrides = {}) => ({
  timestamp: new Date().toISOString(),
  price: 100,
  open: 99,
  high: 101,
  low: 98,
  close: 100,
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PriceChart", () => {
  it("draws a candlestick series from real OHLC data", async () => {
    api.fetchPrice.mockResolvedValue({ series: [ohlcPoint()], data_source: "live" });
    render(<PriceChart asset="TCS" range="1h" displayName="TCS" />);

    await waitFor(() => expect(chart.addCandlestickSeries).toHaveBeenCalled());
    expect(chart.addLineSeries).not.toHaveBeenCalled();
    expect(series.setData).toHaveBeenCalledWith([
      expect.objectContaining({ open: 99, high: 101, low: 98, close: 100 })
    ]);
  });

  it("falls back to a line series for simulated data, which has no OHLC", async () => {
    api.fetchPrice.mockResolvedValue({
      series: [{ timestamp: new Date().toISOString(), price: 100 }],
      data_source: "simulated"
    });
    render(<PriceChart asset="TCS" range="1h" />);

    await waitFor(() => expect(chart.addLineSeries).toHaveBeenCalled());
    expect(chart.addCandlestickSeries).not.toHaveBeenCalled();
    expect(series.setData).toHaveBeenCalledWith([expect.objectContaining({ value: 100 })]);
  });

  it("shows an honest empty state instead of a blank chart when there's no data", async () => {
    api.fetchPrice.mockResolvedValue({ series: [], data_source: "unavailable" });
    render(<PriceChart asset="TCS" range="1h" />);

    await waitFor(() =>
      expect(screen.getByText(/no price data available for this window yet/i)).toBeInTheDocument()
    );
  });

  it("shows an honest error instead of silently failing when the request errors", async () => {
    api.fetchPrice.mockRejectedValue(new Error("network down"));
    render(<PriceChart asset="TCS" range="1h" />);

    await waitFor(() =>
      expect(screen.getByText(/couldn't load the price chart/i)).toBeInTheDocument()
    );
  });

  it("shows the data source badge for what actually came back", async () => {
    api.fetchPrice.mockResolvedValue({ series: [ohlcPoint()], data_source: "delayed" });
    render(<PriceChart asset="TCS" range="1h" />);
    await waitFor(() => expect(screen.getByText(/delayed/i)).toBeInTheDocument());
  });
});
