import Card from "./Card.jsx";

// Maps each asset symbol to its TradingView symbol string
const symbolMap = {
  // Crypto
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  BNB: "BINANCE:BNBUSDT",
  XRP: "BINANCE:XRPUSDT",
  // Stocks
  AAPL: "NASDAQ:AAPL",
  MSFT: "NASDAQ:MSFT",
  GOOGL: "NASDAQ:GOOGL",
  AMZN: "NASDAQ:AMZN",
  NVDA: "NASDAQ:NVDA",
  META: "NASDAQ:META",
  TSLA: "NASDAQ:TSLA",
  NFLX: "NASDAQ:NFLX",
  AMD: "NASDAQ:AMD",
  INTC: "NASDAQ:INTC",
  JPM: "NYSE:JPM",
  V: "NYSE:V",
  DIS: "NYSE:DIS",
  PYPL: "NASDAQ:PYPL",
  UBER: "NYSE:UBER"
};

const TradingViewWidget = ({ asset = "BTC" }) => {
  const widgetConfig = {
    autosize: true,
    symbol: symbolMap[asset] || `NASDAQ:${asset}`,
    interval: "15",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "en",
    allow_symbol_change: true,
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
        key={asset}
        title={`${asset} TradingView chart`}
        src={src}
        className="h-full w-full rounded-md border-0"
        allowFullScreen
      />
    </Card>
  );
};

export default TradingViewWidget;
