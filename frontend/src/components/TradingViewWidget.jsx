import Card from "./Card.jsx";
import PriceChart from "./PriceChart.jsx";

// TradingView's free/anonymous embed does not carry NSE (India) data at all —
// verified against both their embed domains, same "only available on
// TradingView" notice on their own official widget, not just ours. This is a
// data-licensing restriction on TradingView's side, not a symbol-format or
// config problem: no widget parameter fixes it. For these exchanges,
// PriceChart.jsx draws SentiTrade's own candlestick chart from real Yahoo
// Finance OHLC data instead.
const CHART_UNSUPPORTED_EXCHANGES = new Set(["NSE"]);

const TradingViewWidget = ({ asset = "BTC", tvSymbol, exchange, displayName, range = "1h" }) => {
  const symbol = tvSymbol || `NASDAQ:${asset}`;

  if (CHART_UNSUPPORTED_EXCHANGES.has(exchange)) {
    return <PriceChart asset={asset} range={range} displayName={displayName} />;
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
