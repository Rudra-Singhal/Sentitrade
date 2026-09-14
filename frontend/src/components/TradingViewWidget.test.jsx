import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TradingViewWidget from "./TradingViewWidget.jsx";

// PriceChart does real async fetches + canvas rendering — out of scope for
// this component's own tests, which are about routing (iframe vs. own
// chart), not PriceChart's internals (covered in PriceChart.test.jsx).
vi.mock("./PriceChart.jsx", () => ({
  default: ({ asset, range, displayName }) => (
    <div data-testid="price-chart">
      {displayName || asset} · {range}
    </div>
  )
}));

describe("TradingViewWidget", () => {
  it("renders the TradingView iframe for a supported exchange", () => {
    render(<TradingViewWidget asset="BTC" tvSymbol="BINANCE:BTCUSDT" exchange="CRYPTO" />);
    const frame = screen.getByTitle("BTC TradingView chart");
    expect(frame).toBeInTheDocument();
    expect(frame.src).toContain("tradingview-widget.com");
    expect(screen.queryByTestId("price-chart")).not.toBeInTheDocument();
  });

  it("locks allow_symbol_change so a failed symbol can't silently substitute a different one", () => {
    render(<TradingViewWidget asset="AAPL" tvSymbol="NASDAQ:AAPL" exchange="US" />);
    const frame = screen.getByTitle("AAPL TradingView chart");
    const config = JSON.parse(decodeURIComponent(frame.src.split("#")[1]));
    expect(config.allow_symbol_change).toBe(false);
  });

  it("routes NSE to SentiTrade's own PriceChart instead of the broken TradingView embed", () => {
    render(
      <TradingViewWidget
        asset="RELIANCE"
        range="1h"
        tvSymbol="NSE:RELIANCE"
        exchange="NSE"
        displayName="Reliance Industries"
      />
    );
    expect(screen.queryByTitle("RELIANCE TradingView chart")).not.toBeInTheDocument();
    expect(screen.getByTestId("price-chart")).toHaveTextContent("Reliance Industries · 1h");
  });
});
