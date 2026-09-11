// Asset universe: crypto (Binance/CoinGecko), US equities (Yahoo), and
// Indian equities on the NSE (Yahoo `.NS`). Each entry carries everything the
// connectors, pricing providers, TradingView widget and entity resolver need.

const crypto = (symbol, displayName, coingeckoId, extra = {}) => ({
  symbol,
  displayName,
  type: "crypto",
  exchange: "CRYPTO",
  tradingViewSymbol: `BINANCE:${symbol}USDT`,
  binanceSymbol: `${symbol}USDT`,
  coingeckoId,
  query: `${displayName} OR ${symbol} crypto`,
  aliases: Array.from(
    new Set([displayName.toLowerCase(), symbol.toLowerCase(), ...(extra.aliases || [])])
  ),
  wikiArticle: extra.wiki || displayName.replace(/ /g, "_")
});

const usStock = (symbol, displayName, tv, extra = {}) => ({
  symbol,
  displayName,
  type: "stock",
  exchange: "US",
  tradingViewSymbol: tv,
  yahooSymbol: symbol,
  query: `${displayName} stock OR ${symbol} earnings`,
  aliases: Array.from(
    new Set([displayName.toLowerCase(), symbol.toLowerCase(), ...(extra.aliases || [])])
  ),
  wikiArticle: extra.wiki || null
});

const inStock = (symbol, displayName, tv, extra = {}) => ({
  symbol,
  displayName,
  type: "stock",
  exchange: "NSE",
  tradingViewSymbol: tv || `NSE:${symbol}`,
  yahooSymbol: `${symbol}.NS`,
  query: `${displayName} share price OR ${symbol} NSE`,
  aliases: Array.from(
    new Set([displayName.toLowerCase(), symbol.toLowerCase(), ...(extra.aliases || [])])
  ),
  wikiArticle: extra.wiki || null
});

const LIST = [
  // ── Crypto ────────────────────────────────────────────────────────────────
  crypto("BTC", "Bitcoin", "bitcoin", {
    aliases: ["btc", "the king", "orange coin"],
    wiki: "Bitcoin"
  }),
  crypto("ETH", "Ethereum", "ethereum", { aliases: ["ether", "eth"], wiki: "Ethereum" }),
  crypto("SOL", "Solana", "solana", { wiki: "Solana_(blockchain_platform)" }),
  crypto("BNB", "BNB", "binancecoin", {
    aliases: ["binance coin", "binance smart chain", "bsc"],
    wiki: "BNB_(cryptocurrency)"
  }),
  crypto("XRP", "XRP", "ripple", { aliases: ["ripple"], wiki: "XRP_Ledger" }),
  crypto("ADA", "Cardano", "cardano", { wiki: "Cardano_(blockchain_platform)" }),
  crypto("DOGE", "Dogecoin", "dogecoin", { wiki: "Dogecoin" }),
  crypto("AVAX", "Avalanche", "avalanche-2", { wiki: "Avalanche_(blockchain_platform)" }),
  crypto("DOT", "Polkadot", "polkadot", { wiki: "Polkadot_(cryptocurrency)" }),
  crypto("LINK", "Chainlink", "chainlink", { wiki: "Chainlink_(blockchain)" }),
  crypto("TRX", "TRON", "tron", { aliases: ["tron"], wiki: "TRON_(cryptocurrency)" }),
  crypto("MATIC", "Polygon", "matic-network", {
    aliases: ["polygon", "pol"],
    wiki: "Polygon_(blockchain)"
  }),
  crypto("LTC", "Litecoin", "litecoin", { wiki: "Litecoin" }),
  crypto("SHIB", "Shiba Inu", "shiba-inu", {
    aliases: ["shib"],
    wiki: "Shiba_Inu_(cryptocurrency)"
  }),
  crypto("UNI", "Uniswap", "uniswap", { wiki: "Uniswap" }),
  crypto("ATOM", "Cosmos", "cosmos", { aliases: ["cosmos hub"], wiki: "Cosmos_(blockchain)" }),
  crypto("XLM", "Stellar", "stellar", { aliases: ["lumens"], wiki: "Stellar_(payment_network)" }),
  crypto("NEAR", "NEAR Protocol", "near", { aliases: ["near"], wiki: "NEAR_Protocol" }),
  crypto("APT", "Aptos", "aptos", { wiki: "Aptos_(blockchain)" }),
  crypto("ARB", "Arbitrum", "arbitrum", { wiki: "Arbitrum" }),
  crypto("OP", "Optimism", "optimism", { aliases: ["op mainnet"] }),
  crypto("FIL", "Filecoin", "filecoin", { wiki: "Filecoin" }),
  crypto("INJ", "Injective", "injective-protocol"),
  crypto("SUI", "Sui", "sui"),
  crypto("PEPE", "Pepe", "pepe", { aliases: ["pepe coin"] }),

  // ── US equities ───────────────────────────────────────────────────────────
  usStock("AAPL", "Apple", "NASDAQ:AAPL", {
    aliases: ["iphone", "ipad", "tim cook", "vision pro"],
    wiki: "Apple_Inc."
  }),
  usStock("MSFT", "Microsoft", "NASDAQ:MSFT", {
    aliases: ["azure", "windows", "copilot", "satya nadella"],
    wiki: "Microsoft"
  }),
  usStock("GOOGL", "Alphabet", "NASDAQ:GOOGL", {
    aliases: ["google", "youtube", "gemini", "sundar pichai"],
    wiki: "Alphabet_Inc."
  }),
  usStock("AMZN", "Amazon", "NASDAQ:AMZN", {
    aliases: ["aws", "prime", "andy jassy"],
    wiki: "Amazon_(company)"
  }),
  usStock("NVDA", "NVIDIA", "NASDAQ:NVDA", {
    aliases: ["nvidia", "jensen huang", "team green", "h100"],
    wiki: "Nvidia"
  }),
  usStock("META", "Meta", "NASDAQ:META", {
    aliases: ["facebook", "instagram", "whatsapp", "mark zuckerberg"],
    wiki: "Meta_Platforms"
  }),
  usStock("TSLA", "Tesla", "NASDAQ:TSLA", {
    aliases: ["elon musk", "cybertruck", "full self driving", "fsd"],
    wiki: "Tesla,_Inc."
  }),
  usStock("NFLX", "Netflix", "NASDAQ:NFLX", { wiki: "Netflix" }),
  usStock("AMD", "AMD", "NASDAQ:AMD", {
    aliases: ["advanced micro devices", "ryzen", "lisa su", "mi300"],
    wiki: "Advanced_Micro_Devices"
  }),
  usStock("INTC", "Intel", "NASDAQ:INTC", { aliases: ["core ultra"], wiki: "Intel" }),
  usStock("JPM", "JPMorgan", "NYSE:JPM", {
    aliases: ["jpmorgan chase", "jamie dimon"],
    wiki: "JPMorgan_Chase"
  }),
  usStock("V", "Visa", "NYSE:V", { wiki: "Visa_Inc." }),
  usStock("MA", "Mastercard", "NYSE:MA", { wiki: "Mastercard" }),
  usStock("DIS", "Disney", "NYSE:DIS", {
    aliases: ["walt disney", "espn", "bob iger"],
    wiki: "The_Walt_Disney_Company"
  }),
  usStock("PYPL", "PayPal", "NASDAQ:PYPL", { aliases: ["venmo"], wiki: "PayPal" }),
  usStock("UBER", "Uber", "NYSE:UBER", { aliases: ["uber eats"], wiki: "Uber" }),
  usStock("BAC", "Bank of America", "NYSE:BAC", { wiki: "Bank_of_America" }),
  usStock("WMT", "Walmart", "NYSE:WMT", { wiki: "Walmart" }),
  usStock("KO", "Coca-Cola", "NYSE:KO", {
    aliases: ["coca cola", "coke"],
    wiki: "The_Coca-Cola_Company"
  }),
  usStock("PEP", "PepsiCo", "NASDAQ:PEP", { aliases: ["pepsi"], wiki: "PepsiCo" }),
  usStock("XOM", "ExxonMobil", "NYSE:XOM", { aliases: ["exxon"], wiki: "ExxonMobil" }),
  usStock("CVX", "Chevron", "NYSE:CVX", { wiki: "Chevron_Corporation" }),
  usStock("PFE", "Pfizer", "NYSE:PFE", { wiki: "Pfizer" }),
  usStock("JNJ", "Johnson & Johnson", "NYSE:JNJ", {
    aliases: ["johnson and johnson"],
    wiki: "Johnson_%26_Johnson"
  }),
  usStock("BABA", "Alibaba", "NYSE:BABA", { wiki: "Alibaba_Group" }),
  usStock("CRM", "Salesforce", "NYSE:CRM", { wiki: "Salesforce" }),
  usStock("ORCL", "Oracle", "NYSE:ORCL", { wiki: "Oracle_Corporation" }),
  usStock("ADBE", "Adobe", "NASDAQ:ADBE", { wiki: "Adobe_Inc." }),
  usStock("QCOM", "Qualcomm", "NASDAQ:QCOM", { wiki: "Qualcomm" }),
  usStock("COIN", "Coinbase", "NASDAQ:COIN", { wiki: "Coinbase" }),
  usStock("PLTR", "Palantir", "NASDAQ:PLTR", { wiki: "Palantir_Technologies" }),
  usStock("BA", "Boeing", "NYSE:BA", { wiki: "Boeing" }),
  usStock("GE", "GE Aerospace", "NYSE:GE", { aliases: ["general electric"], wiki: "GE_Aerospace" }),
  usStock("F", "Ford", "NYSE:F", { aliases: ["ford motor"], wiki: "Ford_Motor_Company" }),
  usStock("GM", "General Motors", "NYSE:GM", { wiki: "General_Motors" }),
  usStock("NKE", "Nike", "NYSE:NKE", { wiki: "Nike,_Inc." }),
  usStock("SBUX", "Starbucks", "NASDAQ:SBUX", { wiki: "Starbucks" }),
  usStock("MCD", "McDonald's", "NYSE:MCD", { aliases: ["mcdonalds"], wiki: "McDonald's" }),
  usStock("T", "AT&T", "NYSE:T", { aliases: ["at&t", "at and t"], wiki: "AT%26T" }),
  usStock("GS", "Goldman Sachs", "NYSE:GS", { wiki: "Goldman_Sachs" }),

  // ── Indian equities (NSE) ─────────────────────────────────────────────────
  inStock("RELIANCE", "Reliance Industries", "NSE:RELIANCE", {
    aliases: ["reliance", "ril", "mukesh ambani", "jio"],
    wiki: "Reliance_Industries"
  }),
  inStock("TCS", "Tata Consultancy Services", "NSE:TCS", {
    aliases: ["tcs", "tata consultancy"],
    wiki: "Tata_Consultancy_Services"
  }),
  inStock("HDFCBANK", "HDFC Bank", "NSE:HDFCBANK", { aliases: ["hdfc bank"], wiki: "HDFC_Bank" }),
  inStock("INFY", "Infosys", "NSE:INFY", { aliases: ["infosys"], wiki: "Infosys" }),
  inStock("ICICIBANK", "ICICI Bank", "NSE:ICICIBANK", {
    aliases: ["icici bank", "icici"],
    wiki: "ICICI_Bank"
  }),
  inStock("HINDUNILVR", "Hindustan Unilever", "NSE:HINDUNILVR", {
    aliases: ["hul", "hindustan unilever"],
    wiki: "Hindustan_Unilever"
  }),
  inStock("SBIN", "State Bank of India", "NSE:SBIN", {
    aliases: ["sbi", "state bank"],
    wiki: "State_Bank_of_India"
  }),
  inStock("BHARTIARTL", "Bharti Airtel", "NSE:BHARTIARTL", {
    aliases: ["airtel", "bharti airtel"],
    wiki: "Bharti_Airtel"
  }),
  inStock("ITC", "ITC", "NSE:ITC", { aliases: ["itc limited"], wiki: "ITC_Limited" }),
  inStock("LT", "Larsen & Toubro", "NSE:LT", {
    aliases: ["l&t", "larsen and toubro", "larsen toubro"],
    wiki: "Larsen_%26_Toubro"
  }),
  inStock("KOTAKBANK", "Kotak Mahindra Bank", "NSE:KOTAKBANK", {
    aliases: ["kotak", "kotak mahindra"],
    wiki: "Kotak_Mahindra_Bank"
  }),
  inStock("AXISBANK", "Axis Bank", "NSE:AXISBANK", { aliases: ["axis bank"], wiki: "Axis_Bank" }),
  inStock("HCLTECH", "HCLTech", "NSE:HCLTECH", {
    aliases: ["hcl technologies", "hcl tech"],
    wiki: "HCLTech"
  }),
  inStock("ASIANPAINT", "Asian Paints", "NSE:ASIANPAINT", {
    aliases: ["asian paints"],
    wiki: "Asian_Paints"
  }),
  inStock("MARUTI", "Maruti Suzuki", "NSE:MARUTI", {
    aliases: ["maruti", "maruti suzuki"],
    wiki: "Maruti_Suzuki"
  }),
  inStock("SUNPHARMA", "Sun Pharma", "NSE:SUNPHARMA", {
    aliases: ["sun pharmaceutical", "sun pharma"],
    wiki: "Sun_Pharmaceutical"
  }),
  inStock("TITAN", "Titan Company", "NSE:TITAN", { aliases: ["titan"], wiki: "Titan_Company" }),
  inStock("BAJFINANCE", "Bajaj Finance", "NSE:BAJFINANCE", {
    aliases: ["bajaj finance"],
    wiki: "Bajaj_Finance"
  }),
  inStock("WIPRO", "Wipro", "NSE:WIPRO", { aliases: ["wipro"], wiki: "Wipro" }),
  inStock("ULTRACEMCO", "UltraTech Cement", "NSE:ULTRACEMCO", {
    aliases: ["ultratech", "ultratech cement"],
    wiki: "UltraTech_Cement"
  }),
  inStock("NESTLEIND", "Nestle India", "NSE:NESTLEIND", {
    aliases: ["nestle india"],
    wiki: "Nestl%C3%A9_India"
  }),
  inStock("ONGC", "ONGC", "NSE:ONGC", {
    aliases: ["oil and natural gas corporation"],
    wiki: "Oil_and_Natural_Gas_Corporation"
  }),
  inStock("NTPC", "NTPC", "NSE:NTPC", {
    aliases: ["national thermal power"],
    wiki: "NTPC_Limited"
  }),
  inStock("POWERGRID", "Power Grid Corporation", "NSE:POWERGRID", {
    aliases: ["power grid", "powergrid"],
    wiki: "Power_Grid_Corporation_of_India"
  }),
  inStock("ADANIENT", "Adani Enterprises", "NSE:ADANIENT", {
    aliases: ["adani enterprises", "gautam adani"],
    wiki: "Adani_Enterprises"
  }),
  inStock("ADANIPORTS", "Adani Ports", "NSE:ADANIPORTS", {
    aliases: ["adani ports", "apsez"],
    wiki: "Adani_Ports_%26_SEZ"
  }),
  inStock("COALINDIA", "Coal India", "NSE:COALINDIA", {
    aliases: ["coal india"],
    wiki: "Coal_India"
  }),
  inStock("TATAMOTORS", "Tata Motors", "NSE:TATAMOTORS", {
    aliases: ["tata motors", "jaguar land rover", "jlr"],
    wiki: "Tata_Motors"
  }),
  inStock("TATASTEEL", "Tata Steel", "NSE:TATASTEEL", {
    aliases: ["tata steel"],
    wiki: "Tata_Steel"
  }),
  inStock("JSWSTEEL", "JSW Steel", "NSE:JSWSTEEL", { aliases: ["jsw steel"], wiki: "JSW_Steel" }),
  inStock("HDFCLIFE", "HDFC Life", "NSE:HDFCLIFE", {
    aliases: ["hdfc life insurance"],
    wiki: "HDFC_Life"
  }),
  inStock("BAJAJFINSV", "Bajaj Finserv", "NSE:BAJAJFINSV", {
    aliases: ["bajaj finserv"],
    wiki: "Bajaj_Finserv"
  }),
  inStock("M&M", "Mahindra & Mahindra", "NSE:M_M", {
    aliases: ["mahindra", "mahindra and mahindra", "m&m"],
    wiki: "Mahindra_%26_Mahindra"
  }),
  inStock("DMART", "Avenue Supermarts", "NSE:DMART", {
    aliases: ["dmart", "avenue supermarts", "d-mart"],
    wiki: "DMart"
  }),
  inStock("ZOMATO", "Eternal", "NSE:ZOMATO", {
    aliases: ["zomato", "eternal", "blinkit"],
    wiki: "Zomato"
  }),
  inStock("PAYTM", "One 97 Communications", "NSE:PAYTM", {
    aliases: ["paytm", "one97"],
    wiki: "Paytm"
  }),
  inStock("IRCTC", "IRCTC", "NSE:IRCTC", {
    aliases: ["indian railway catering"],
    wiki: "Indian_Railway_Catering_and_Tourism_Corporation"
  }),
  inStock("DRREDDY", "Dr. Reddy's Laboratories", "NSE:DRREDDY", {
    aliases: ["dr reddy", "dr reddys", "dr. reddy's"],
    wiki: "Dr._Reddy's_Laboratories"
  }),
  inStock("CIPLA", "Cipla", "NSE:CIPLA", { aliases: ["cipla"], wiki: "Cipla" }),
  inStock("HAL", "Hindustan Aeronautics", "NSE:HAL", {
    aliases: ["hindustan aeronautics", "hal"],
    wiki: "Hindustan_Aeronautics_Limited"
  })
];

const ASSETS = Object.fromEntries(LIST.map((a) => [a.symbol, a]));

const normalizeAsset = (asset = "BTC") => {
  const key = String(asset).trim().toUpperCase();
  return ASSETS[key] || ASSETS.BTC;
};

const listAssets = () =>
  LIST.map(({ symbol, displayName, type, exchange, tradingViewSymbol }) => ({
    symbol,
    displayName,
    type,
    exchange,
    tradingViewSymbol
  }));

/** Lowercased keyword set for matching an asset in free text. */
const keywordsFor = (assetConfig) =>
  Array.from(
    new Set([assetConfig.symbol.toLowerCase(), ...(assetConfig.aliases || [])].filter(Boolean))
  );

const mentionsAsset = (text, assetConfig) => {
  const haystack = String(text || "").toLowerCase();
  return keywordsFor(assetConfig).some((kw) =>
    new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(
      haystack
    )
  );
};

module.exports = { ASSETS, LIST, normalizeAsset, listAssets, keywordsFor, mentionsAsset };
