const ASSETS = {
  // ── Crypto ──────────────────────────────────────────────────────────────
  BTC: {
    symbol: "BTC",
    query: "bitcoin OR BTC crypto",
    displayName: "Bitcoin",
    tradingViewSymbol: "BINANCE:BTCUSDT",
    coingeckoId: "bitcoin",
    type: "crypto",
    mockBase: 67350,
    mockVolatility: 0.022
  },
  ETH: {
    symbol: "ETH",
    query: "ethereum OR ETH crypto",
    displayName: "Ethereum",
    tradingViewSymbol: "BINANCE:ETHUSDT",
    coingeckoId: "ethereum",
    type: "crypto",
    mockBase: 3420,
    mockVolatility: 0.019
  },
  SOL: {
    symbol: "SOL",
    query: "solana OR SOL crypto",
    displayName: "Solana",
    tradingViewSymbol: "BINANCE:SOLUSDT",
    coingeckoId: "solana",
    type: "crypto",
    mockBase: 175,
    mockVolatility: 0.028
  },
  BNB: {
    symbol: "BNB",
    query: "BNB OR Binance Coin crypto",
    displayName: "BNB",
    tradingViewSymbol: "BINANCE:BNBUSDT",
    coingeckoId: "binancecoin",
    type: "crypto",
    mockBase: 590,
    mockVolatility: 0.015
  },
  XRP: {
    symbol: "XRP",
    query: "XRP OR Ripple crypto",
    displayName: "XRP",
    tradingViewSymbol: "BINANCE:XRPUSDT",
    coingeckoId: "ripple",
    type: "crypto",
    mockBase: 0.62,
    mockVolatility: 0.025
  },

  // ── Stocks ───────────────────────────────────────────────────────────────
  AAPL: {
    symbol: "AAPL",
    query: "Apple stock OR AAPL earnings",
    displayName: "Apple",
    tradingViewSymbol: "NASDAQ:AAPL",
    type: "stock",
    mockBase: 189,
    mockVolatility: 0.009
  },
  MSFT: {
    symbol: "MSFT",
    query: "Microsoft stock OR MSFT earnings",
    displayName: "Microsoft",
    tradingViewSymbol: "NASDAQ:MSFT",
    type: "stock",
    mockBase: 415,
    mockVolatility: 0.010
  },
  GOOGL: {
    symbol: "GOOGL",
    query: "Google OR Alphabet stock OR GOOGL",
    displayName: "Alphabet",
    tradingViewSymbol: "NASDAQ:GOOGL",
    type: "stock",
    mockBase: 175,
    mockVolatility: 0.011
  },
  AMZN: {
    symbol: "AMZN",
    query: "Amazon stock OR AMZN earnings",
    displayName: "Amazon",
    tradingViewSymbol: "NASDAQ:AMZN",
    type: "stock",
    mockBase: 185,
    mockVolatility: 0.012
  },
  NVDA: {
    symbol: "NVDA",
    query: "Nvidia stock OR NVDA AI chips",
    displayName: "NVIDIA",
    tradingViewSymbol: "NASDAQ:NVDA",
    type: "stock",
    mockBase: 875,
    mockVolatility: 0.018
  },
  META: {
    symbol: "META",
    query: "Meta Platforms stock OR META earnings",
    displayName: "Meta",
    tradingViewSymbol: "NASDAQ:META",
    type: "stock",
    mockBase: 490,
    mockVolatility: 0.013
  },
  TSLA: {
    symbol: "TSLA",
    query: "Tesla stock OR TSLA earnings Elon Musk",
    displayName: "Tesla",
    tradingViewSymbol: "NASDAQ:TSLA",
    type: "stock",
    mockBase: 185,
    mockVolatility: 0.025
  },
  NFLX: {
    symbol: "NFLX",
    query: "Netflix stock OR NFLX subscribers earnings",
    displayName: "Netflix",
    tradingViewSymbol: "NASDAQ:NFLX",
    type: "stock",
    mockBase: 635,
    mockVolatility: 0.014
  },
  AMD: {
    symbol: "AMD",
    query: "AMD stock OR Advanced Micro Devices chips",
    displayName: "AMD",
    tradingViewSymbol: "NASDAQ:AMD",
    type: "stock",
    mockBase: 170,
    mockVolatility: 0.020
  },
  INTC: {
    symbol: "INTC",
    query: "Intel stock OR INTC semiconductor earnings",
    displayName: "Intel",
    tradingViewSymbol: "NASDAQ:INTC",
    type: "stock",
    mockBase: 38,
    mockVolatility: 0.012
  },
  JPM: {
    symbol: "JPM",
    query: "JPMorgan Chase stock OR JPM banking earnings",
    displayName: "JPMorgan",
    tradingViewSymbol: "NYSE:JPM",
    type: "stock",
    mockBase: 200,
    mockVolatility: 0.008
  },
  V: {
    symbol: "V",
    query: "Visa stock OR V payments earnings",
    displayName: "Visa",
    tradingViewSymbol: "NYSE:V",
    type: "stock",
    mockBase: 275,
    mockVolatility: 0.007
  },
  DIS: {
    symbol: "DIS",
    query: "Disney stock OR DIS streaming earnings",
    displayName: "Disney",
    tradingViewSymbol: "NYSE:DIS",
    type: "stock",
    mockBase: 108,
    mockVolatility: 0.011
  },
  PYPL: {
    symbol: "PYPL",
    query: "PayPal stock OR PYPL fintech earnings",
    displayName: "PayPal",
    tradingViewSymbol: "NASDAQ:PYPL",
    type: "stock",
    mockBase: 62,
    mockVolatility: 0.016
  },
  UBER: {
    symbol: "UBER",
    query: "Uber stock OR UBER ride-sharing earnings",
    displayName: "Uber",
    tradingViewSymbol: "NYSE:UBER",
    type: "stock",
    mockBase: 74,
    mockVolatility: 0.017
  }
};

const normalizeAsset = (asset = "BTC") => {
  const key = String(asset).trim().toUpperCase();
  return ASSETS[key] || ASSETS.BTC;
};

const listAssets = () => Object.values(ASSETS);

module.exports = { ASSETS, normalizeAsset, listAssets };
