import Card from "./Card.jsx";

const TradingViewWidget = ({ asset = "BTC", tvSymbol }) => {
  const symbol = tvSymbol || `NASDAQ:${asset}`;
  const widgetConfig = {
    autosize: true,
    symbol,
    interval: "15",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    // `false`, deliberately: TradingView's free/anonymous embed doesn't
    // resolve every symbol we track (several NSE tickers among them). With
    // this left `true`, a failed symbol makes the widget silently fall back
    // to its own default (commonly AAPL) — which looks like SentiTrade is
    // showing you the wrong stock's chart, when really only the third-party
    // widget failed. Locking it keeps the chart honestly blank/erroring
    // instead of quietly substituting a different company's price action.
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
      <p className="mt-1 px-1 text-xs text-slate-500">
        Chart from TradingView. Some symbols aren&apos;t available on their free embed — if the
        chart looks wrong or empty, the sentiment data alongside it is unaffected and still
        correct for {asset}.
      </p>
    </Card>
  );
};

export default TradingViewWidget;
