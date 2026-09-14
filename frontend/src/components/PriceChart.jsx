import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { fetchPrice } from "../services/api.js";

// Same engine family as the TradingView widget elsewhere in this app
// (lightweight-charts is TradingView's own open-source charting library) —
// fed by SentiTrade's own OHLC data instead of TradingView's hosted feed,
// which doesn't carry NSE (India) market data on its free embed at all.
const REFRESH_MS = 25_000;

const toUnixSeconds = (iso) => Math.floor(new Date(iso).getTime() / 1000);

/** A candlestick when every OHLC field is real (live providers); a plain line
 * for simulated data, which only ever has a bare price. Never fabricates a
 * candle body from a single number. */
const hasRealOhlc = (point) =>
  typeof point.open === "number" &&
  typeof point.high === "number" &&
  typeof point.low === "number" &&
  typeof point.close === "number";

const PriceChart = ({ asset, range, displayName }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [dataSource, setDataSource] = useState(null);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);

  // Chart + series lifecycle: created once per mount, resized on container
  // change, torn down on unmount. Series *type* (candlestick vs. line) can
  // change between fetches (e.g. going from simulated to live), so it's
  // recreated when that changes rather than mutated in place.
  const seriesKindRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(226,232,240,0.6)"
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.06)" }
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true },
      crosshair: { mode: 0 },
      autoSize: true
    });
    chartRef.current = chart;

    const resize = () => chart.applyOptions({ width: containerRef.current.clientWidth });
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      seriesKindRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      try {
        const { series, data_source: source } = await fetchPrice(asset, range);
        if (cancelled || !chartRef.current) return;

        setError("");
        setDataSource(source);
        setEmpty(!series.length);
        if (!series.length) return;

        const kind = hasRealOhlc(series[0]) ? "candlestick" : "line";
        if (seriesKindRef.current !== kind) {
          if (seriesRef.current) chartRef.current.removeSeries(seriesRef.current);
          seriesRef.current =
            kind === "candlestick"
              ? chartRef.current.addCandlestickSeries({
                  upColor: "#39FF88",
                  downColor: "#FF5C7A",
                  borderVisible: false,
                  wickUpColor: "#39FF88",
                  wickDownColor: "#FF5C7A"
                })
              : chartRef.current.addLineSeries({ color: "#58D5FF", lineWidth: 2 });
          seriesKindRef.current = kind;
        }

        const chartData =
          kind === "candlestick"
            ? series.map((p) => ({
                time: toUnixSeconds(p.timestamp),
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close
              }))
            : series.map((p) => ({ time: toUnixSeconds(p.timestamp), value: p.price }));

        seriesRef.current.setData(chartData);
        chartRef.current.timeScale().fitContent();
      } catch {
        if (!cancelled) setError("Couldn't load the price chart right now.");
      }
    };

    load();
    timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [asset, range]);

  return (
    <Card className="h-[560px] overflow-hidden p-3 lg:h-[690px]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          {displayName || asset} price
        </p>
        <DataSourceBadge source={dataSource} />
      </div>
      <div className="relative h-[calc(100%-2rem)] w-full">
        <div ref={containerRef} className="h-full w-full" />
        {(error || empty) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-sm text-slate-400">
            {error || "No price data available for this window yet."}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PriceChart;
