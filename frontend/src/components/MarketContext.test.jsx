import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketContext from "./MarketContext.jsx";

const base = {
  context: {
    fear_greed: { value: 69, label: "Greed", source: "alternative.me", data_source: "live" },
    attention: { ratio: 1.4, source: "Wikipedia", data_source: "delayed" }
  },
  social: { score_percent: 58, count: 24, bull_bear_ratio: 1.8 },
  news_retail_divergence: 9,
  events: [{ type: "earnings", title: "Apple 8-K filing", at: new Date().toISOString() }]
};

describe("MarketContext", () => {
  it("shows fear & greed, attention and retail tone", () => {
    render(<MarketContext sentiment={base} />);
    expect(screen.getByText("69")).toBeInTheDocument();
    expect(screen.getByText("Greed")).toBeInTheDocument();
    expect(screen.getByText("1.4×")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument();
  });

  it("describes the news vs retail divergence", () => {
    render(<MarketContext sentiment={base} />);
    expect(screen.getByText(/9 pts more positive than retail/i)).toBeInTheDocument();
  });

  it("lists recent events", () => {
    render(<MarketContext sentiment={base} />);
    expect(screen.getByText(/earnings/)).toBeInTheDocument();
    expect(screen.getByText("Apple 8-K filing")).toBeInTheDocument();
  });

  it("degrades gracefully with no context", () => {
    render(<MarketContext sentiment={null} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/No recent filings/i)).toBeInTheDocument();
  });
});
