import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import AssetSelector from "../components/AssetSelector.jsx";
import TimeFilter from "../components/TimeFilter.jsx";
import TradingViewWidget from "../components/TradingViewWidget.jsx";
import SentimentGauge from "../components/SentimentGauge.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import SentimentChart from "../components/SentimentChart.jsx";
import CorrelationBox from "../components/CorrelationBox.jsx";
import MarketMetrics from "../components/MarketMetrics.jsx";
import MarketContext from "../components/MarketContext.jsx";
import AlertBanner from "../components/AlertBanner.jsx";
import GlobalDataBanner from "../components/GlobalDataBanner.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { fetchAssets, fetchCorrelation, fetchSentiment, fetchTrend } from "../services/api.js";
import { createSocket } from "../services/socket.js";
import { worstSource } from "../lib/dataSource.js";

const fallbackAssets = [
  { symbol: "BTC", displayName: "Bitcoin", type: "crypto" },
  { symbol: "ETH", displayName: "Ethereum", type: "crypto" },
  { symbol: "SOL", displayName: "Solana", type: "crypto" },
  { symbol: "BNB", displayName: "BNB", type: "crypto" },
  { symbol: "XRP", displayName: "XRP", type: "crypto" },
  { symbol: "AAPL", displayName: "Apple", type: "stock" },
  { symbol: "MSFT", displayName: "Microsoft", type: "stock" },
  { symbol: "GOOGL", displayName: "Alphabet", type: "stock" },
  { symbol: "AMZN", displayName: "Amazon", type: "stock" },
  { symbol: "NVDA", displayName: "NVIDIA", type: "stock" },
  { symbol: "META", displayName: "Meta", type: "stock" },
  { symbol: "TSLA", displayName: "Tesla", type: "stock" },
  { symbol: "NFLX", displayName: "Netflix", type: "stock" },
  { symbol: "AMD", displayName: "AMD", type: "stock" },
  { symbol: "INTC", displayName: "Intel", type: "stock" },
  { symbol: "JPM", displayName: "JPMorgan", type: "stock" },
  { symbol: "V", displayName: "Visa", type: "stock" },
  { symbol: "DIS", displayName: "Disney", type: "stock" },
  { symbol: "PYPL", displayName: "PayPal", type: "stock" },
  { symbol: "UBER", displayName: "Uber", type: "stock" }
];

const Dashboard = () => {
  const [assets, setAssets] = useState(fallbackAssets);
  const [asset, setAsset] = useState("BTC");
  const [range, setRange] = useState("24h");
  const [sentiment, setSentiment] = useState(null);
  const [trend, setTrend] = useState([]);
  const [trendSource, setTrendSource] = useState(null);
  const [correlation, setCorrelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting"); // connecting | live | reconnecting

  const socketRef = useRef(null);
  const selectionRef = useRef({ asset, range });
  useEffect(() => {
    selectionRef.current = { asset, range };
  }, [asset, range]);

  const selectedAsset = useMemo(
    () => assets.find((item) => item.symbol === asset) || fallbackAssets[0],
    [assets, asset]
  );

  const worstDataSource = useMemo(
    () => worstSource(sentiment?.data_source, correlation?.data_source, trendSource),
    [sentiment?.data_source, correlation?.data_source, trendSource]
  );

  // REST fetch — used only for the very first paint and as a fallback when the
  // socket is down. Once the socket is live it is the single source of truth.
  const loadViaRest = useCallback(async (a, r) => {
    setLoading(true);
    setError("");
    try {
      const [sentimentData, trendData, correlationData] = await Promise.all([
        fetchSentiment(a, r),
        fetchTrend(a, r),
        fetchCorrelation(a, r)
      ]);
      setSentiment(sentimentData);
      setTrend(trendData.points || []);
      setTrendSource(trendData.data_source || null);
      setCorrelation(correlationData);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const applySnapshot = useCallback((payload, want) => {
    if (payload?.sentiment?.asset !== want.asset) return;
    if (payload?.correlation?.range && payload.correlation.range !== want.range) return;
    setSentiment(payload.sentiment);
    setCorrelation(payload.correlation);
    setTrend(payload.correlation?.trend || []);
    setTrendSource(payload.correlation?.data_source || null);
    setLoading(false);
    setError("");
  }, []);

  const refresh = useCallback(() => {
    const { asset: a, range: r } = selectionRef.current;
    if (socketRef.current?.connected)
      socketRef.current.emit("asset:change", { asset: a, range: r });
    else loadViaRest(a, r);
  }, [loadViaRest]);

  // Asset list
  useEffect(() => {
    fetchAssets()
      .then(setAssets)
      .catch(() => setAssets(fallbackAssets));
  }, []);

  // First paint
  useEffect(() => {
    loadViaRest(asset, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket lifecycle
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("live");
      socket.emit("asset:change", selectionRef.current);
    });
    socket.on("disconnect", () => setSocketStatus("reconnecting"));
    socket.io.on("reconnect_attempt", () => setSocketStatus("reconnecting"));
    socket.on("sentiment:update", (payload) => applySnapshot(payload, selectionRef.current));
    socket.on("sentiment:error", (message) => setError(String(message)));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [applySnapshot]);

  // Selection change: prefer the socket; fall back to REST when offline
  useEffect(() => {
    if (socketRef.current?.connected) {
      setLoading(true);
      socketRef.current.emit("asset:change", { asset, range });
    } else {
      loadViaRest(asset, range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, range]);

  const connectionPill = {
    live: { cls: "border-neon/25 bg-neon/10 text-neon", icon: <Wifi size={16} />, label: "Live" },
    connecting: {
      cls: "border-cyanline/25 bg-cyanline/10 text-cyanline",
      icon: <Loader2 size={16} className="animate-spin" />,
      label: "Connecting"
    },
    reconnecting: {
      cls: "border-warning/25 bg-warning/10 text-warning",
      icon: <WifiOff size={16} />,
      label: "Reconnecting"
    }
  }[socketStatus];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-neon shadow-glow" />
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
                News sentiment vs price · educational
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">SentiTrade</h1>
            <p className="mt-2 text-sm text-slate-400">
              {selectedAsset.displayName}: how recent news tone compares with price movement. Not a
              price forecast and not investment advice.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <AssetSelector assets={assets} selected={asset} onChange={setAsset} />
            <TimeFilter value={range} onChange={setRange} />
            <button
              type="button"
              onClick={refresh}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <GlobalDataBanner worst={worstDataSource} />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AlertBanner sentiment={sentiment} />
          <div
            className={`flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${connectionPill.cls}`}
          >
            {connectionPill.icon}
            {connectionPill.label}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)]">
          <TradingViewWidget asset={asset} />

          <aside className="grid gap-5">
            <SentimentGauge data={sentiment} loading={loading} />
            <CorrelationBox data={correlation} summary={sentiment?.summary} />
            <NewsFeed
              items={sentiment?.items || []}
              loading={loading}
              source={sentiment?.data_source}
            />
          </aside>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <SentimentChart points={trend} source={trendSource} />
          <MarketMetrics sentiment={sentiment} trend={trend} correlation={correlation} />
        </section>

        <section className="mt-5">
          <MarketContext sentiment={sentiment} />
        </section>

        <Disclaimer />
      </div>
    </main>
  );
};

export default Dashboard;
