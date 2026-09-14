import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";

const sentimentFixture = (over = {}) => ({
  asset: "BTC",
  assetName: "Bitcoin",
  score_percent: 61,
  sentiment_label: "positive",
  data_source: "live",
  as_of: new Date().toISOString(),
  items: [
    {
      _id: "1",
      text: "Bitcoin demand improves",
      source: "CoinDesk",
      sentiment_label: "positive",
      timestamp: new Date().toISOString()
    }
  ],
  signal: {
    signal: "HOLD",
    strength: "low",
    reasons: ["Mixed."],
    disclaimer: "Not investment advice."
  },
  summary: "BTC news tone is positive.",
  ...over
});

const correlationFixture = (over = {}) => ({
  asset: "BTC",
  range: "1h",
  data_source: "live",
  note: "Not a predictive correlation.",
  insight: "Sentiment and price moved in the same direction this window.",
  sentiment_change: 5,
  price_change: 1.2,
  trend: [
    { timestamp: new Date().toISOString(), sentiment_percent: 55 },
    { timestamp: new Date().toISOString(), sentiment_percent: 60 }
  ],
  signal: { signal: "HOLD", strength: "low" },
  ...over
});

const api = vi.hoisted(() => ({
  fetchAssets: vi.fn(),
  fetchSentiment: vi.fn(),
  fetchTrend: vi.fn(),
  fetchCorrelation: vi.fn()
}));

vi.mock("../services/api.js", () => api);

const socketHandlers = {};
const fakeSocket = {
  connected: false,
  on: vi.fn((event, cb) => {
    socketHandlers[event] = cb;
  }),
  io: { on: vi.fn() },
  emit: vi.fn(),
  close: vi.fn()
};
vi.mock("../services/socket.js", () => ({ createSocket: () => fakeSocket }));

// TradingView iframe is noise in jsdom.
vi.mock("../components/TradingViewWidget.jsx", () => ({ default: () => <div data-testid="tv" /> }));

import Dashboard from "./Dashboard.jsx";

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchAssets.mockResolvedValue([{ symbol: "BTC", displayName: "Bitcoin", type: "crypto" }]);
  api.fetchSentiment.mockResolvedValue(sentimentFixture());
  api.fetchTrend.mockResolvedValue({ points: correlationFixture().trend, data_source: "live" });
  api.fetchCorrelation.mockResolvedValue(correlationFixture());
});

describe("Dashboard", () => {
  it("does a first-paint REST load and renders the data", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(api.fetchSentiment).toHaveBeenCalled());
    expect(await screen.findByText(/61%/)).toBeInTheDocument();
    expect(screen.getByText(/Bitcoin demand improves/)).toBeInTheDocument();
    expect(screen.getAllByText(/not a predictive correlation/i).length).toBeGreaterThan(0);
  });

  it("shows the demo banner when data is simulated", async () => {
    api.fetchSentiment.mockResolvedValue(sentimentFixture({ data_source: "simulated" }));
    api.fetchCorrelation.mockResolvedValue(correlationFixture({ data_source: "simulated" }));
    api.fetchTrend.mockResolvedValue({ points: [], data_source: "simulated" });
    render(<Dashboard />);
    expect(await screen.findByText(/some panels below show/i)).toBeInTheDocument();
  });

  it("surfaces a REST error", async () => {
    api.fetchSentiment.mockRejectedValue(new Error("boom"));
    render(<Dashboard />);
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  it("renders the persistent disclaimer", async () => {
    render(<Dashboard />);
    expect(await screen.findByText(/educational project/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /how this works/i })).toBeInTheDocument();
  });

  it("has no obvious accessibility violations", async () => {
    const { container } = render(<Dashboard />);
    await screen.findByText(/61%/);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
