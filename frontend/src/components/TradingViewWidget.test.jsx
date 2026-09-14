import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TradingViewWidget from "./TradingViewWidget.jsx";

describe("TradingViewWidget", () => {
  it("renders the TradingView iframe for a supported exchange", () => {
    render(<TradingViewWidget asset="BTC" tvSymbol="BINANCE:BTCUSDT" exchange="CRYPTO" />);
    const frame = screen.getByTitle("BTC TradingView chart");
    expect(frame).toBeInTheDocument();
    expect(frame.src).toContain("tradingview-widget.com");
  });

  it("locks allow_symbol_change so a failed symbol can't silently substitute a different one", () => {
    render(<TradingViewWidget asset="AAPL" tvSymbol="NASDAQ:AAPL" exchange="US" />);
    const frame = screen.getByTitle("AAPL TradingView chart");
    const config = JSON.parse(decodeURIComponent(frame.src.split("#")[1]));
    expect(config.allow_symbol_change).toBe(false);
  });

  it("skips the broken iframe for NSE and shows the real price instead", () => {
    render(
      <TradingViewWidget
        asset="RELIANCE"
        tvSymbol="NSE:RELIANCE"
        exchange="NSE"
        displayName="Reliance Industries"
        currentPrice={1432.5}
        priceSource="live"
      />
    );
    expect(screen.queryByTitle("RELIANCE TradingView chart")).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available for Reliance Industries/i)).toBeInTheDocument();
    expect(screen.getByText("₹1,432.5")).toBeInTheDocument();
    expect(screen.getByText(/Live · Yahoo Finance/)).toBeInTheDocument();
  });

  it("shows an honest placeholder for NSE when no price is available yet", () => {
    render(<TradingViewWidget asset="TCS" tvSymbol="NSE:TCS" exchange="NSE" displayName="TCS" />);
    expect(screen.getByText(/Price not available for this window yet/i)).toBeInTheDocument();
  });
});
