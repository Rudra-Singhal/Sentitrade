import Card from "./Card.jsx";

// TradingView's free/anonymous embed does not carry NSE (India) data at all —
// verified against both their embed domains, same "only available on
// TradingView" notice on their own official widget, not just ours. This is a
// data-licensing restriction on TradingView's side, not a symbol-format or
// config problem: no widget parameter fixes it. Rather than show a broken
// iframe and TradingView's own intrusive popup, skip the embed for these and
// show the real price SentiTrade already has from Yahoo Finance instead.
const CHART_UNSUPPORTED_EXCHANGES = new Set(["NSE"]);

const formatPrice = (value, exchange) => {
  if (typeof value !== "number") return null;
  const currency = exchange === "NSE" ? "₹" : "$";
  return `${currency}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const PRICE_SOURCE_LABEL = {
  live: "Live",
  delayed: "Delayed",
  cached: "Cached",
  simulated: "Simulated",
  unavailable: "Unavailable"
};

/** Shown instead of the iframe for exchanges TradingView's free embed can't serve. */
const ChartUnavailable = ({ asset, displayName, currentPrice, priceSource, exchange }) => {
  const price = formatPrice(currentPrice, exchange);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-slate-300">
        Live chart isn&apos;t available for {displayName || asset} here
      </p>
      <p className="max-w-sm text-xs text-slate-500">
        TradingView&apos;s free embed doesn&apos;t carry NSE (India) market data — that&apos;s a
        restriction on their side, not a SentiTrade data problem. The real price below, and every
        sentiment figure on this page, is unaffected.
      </p>
      {price ? (
        <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-5 py-3">
          <div className="text-2xl font-bold text-slate-100">{price}</div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
            {PRICE_SOURCE_LABEL[priceSource] || "Price"} · Yahoo Finance
          </div>
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-600">Price not available for this window yet.</div>
      )}
    </div>
  );
};

const TradingViewWidget = ({
  asset = "BTC",
  tvSymbol,
  exchange,
  displayName,
  currentPrice,
  priceSource
}) => {
  const symbol = tvSymbol || `NASDAQ:${asset}`;

  if (CHART_UNSUPPORTED_EXCHANGES.has(exchange)) {
    return (
      <Card className="h-[560px] overflow-hidden p-2 lg:h-[690px]">
        <ChartUnavailable
          asset={asset}
          displayName={displayName}
          currentPrice={currentPrice}
          priceSource={priceSource}
          exchange={exchange}
        />
      </Card>
    );
  }

  const widgetConfig = {
    autosize: true,
    symbol,
    interval: "15",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    // `false`, deliberately: on a symbol the embed can't resolve, leaving
    // this `true` lets the widget silently fall back to its own default
    // (commonly AAPL) instead of erroring — which looks like SentiTrade
    // switched to the wrong stock. Locked so a failure stays visible.
    allow_symbol_change: false,
    calendar: false,
    support_host: "https://www.tradingview.com",
    hide_side_toolbar: false,
    withdateranges: true
  };

  const src = `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(
    JSON.stringify(widgetConfig)
  )}`;

  return (
    <Card className="h-[560px] overflow-hidden p-2 lg:h-[690px]">
      <iframe
        key={symbol}
        title={`${asset} TradingView chart`}
        src={src}
        className="h-full w-full rounded-md border-0"
        allowFullScreen
      />
    </Card>
  );
};

export default TradingViewWidget;
