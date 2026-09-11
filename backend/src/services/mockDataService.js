const { analyzeHeadline } = require("./sentimentService");

// Each entry: [headline, source, minutesAgo]
const headlineBank = {
  BTC: [
    ["Bitcoin spot ETF inflows accelerate as institutional demand improves", "CoinDesk", 14],
    ["Analysts warn crypto traders remain cautious before inflation data", "Reuters", 11],
    ["Bitcoin miners rally after network fees rebound", "The Block", 8],
    ["Digital asset funds see strongest weekly demand in two months", "Bloomberg", 5],
    ["Crypto market pauses as investors weigh rate outlook", "MarketWatch", 2],
    ["Bitcoin volatility climbs after derivatives liquidations", "CryptoBriefing", 1]
  ],
  ETH: [
    ["Ethereum staking activity rises as layer two usage expands", "CoinTelegraph", 13],
    ["Developers highlight Ethereum scaling progress after network upgrade", "Decrypt", 10],
    ["Ether traders stay neutral ahead of macro data", "Reuters", 7],
    ["Ethereum ecosystem funding improves despite choppy market", "The Block", 4],
    ["Gas fees edge higher as on-chain demand returns", "CoinDesk", 2],
    ["Ether slips as risk appetite cools across crypto markets", "MarketWatch", 1]
  ],
  SOL: [
    ["Solana surges as DeFi activity on the network hits record highs", "CoinDesk", 15],
    ["Validators celebrate Solana's improved uptime after past outages", "Decrypt", 11],
    ["SOL token gains as NFT marketplace volume recovers", "The Block", 8],
    ["Solana faces stiff competition from rival layer-one chains", "Reuters", 5],
    ["Institutional interest in Solana picks up ahead of next upgrade", "Bloomberg", 3],
    ["SOL dips on broader crypto market weakness", "CryptoBriefing", 1]
  ],
  BNB: [
    ["Binance reports record trading volume boosting BNB demand", "CoinDesk", 14],
    ["BNB Chain ecosystem expands with new DeFi protocol launches", "The Block", 10],
    ["Regulators scrutinize Binance operations raising BNB uncertainty", "Reuters", 7],
    ["BNB burn event reduces supply sparking price rally", "CryptoSlate", 4],
    ["Binance Smart Chain TVL climbs to multi-month high", "Decrypt", 2],
    ["BNB consolidates as investors digest regulatory news", "MarketWatch", 1]
  ],
  XRP: [
    ["Ripple wins partial court victory lifting XRP sentiment substantially", "CoinDesk", 16],
    ["Banks pilot XRP-based cross-border payment corridors", "Reuters", 12],
    ["XRP price eyes key resistance after legal clarity improves", "The Block", 9],
    ["Ripple expands partnerships with emerging market financial institutions", "Bloomberg", 6],
    ["XRP traders cautious as SEC appeal timeline remains unclear", "CryptoSlate", 3],
    ["Volume in XRP markets picks up ahead of expected ruling", "MarketWatch", 1]
  ],
  AAPL: [
    ["Apple shares gain as services revenue outlook strengthens", "CNBC", 16],
    ["Analysts stay mixed on Apple hardware cycle before earnings", "Reuters", 12],
    ["Apple expands AI features across devices to boost upgrade demand", "Bloomberg", 9],
    ["Investors watch iPhone demand signals as Apple stock consolidates", "MarketWatch", 6],
    ["Supply chain checks show stable Apple component orders", "Barron's", 3],
    [
      "Apple faces pressure from cautious consumer spending environment",
      "The Wall Street Journal",
      1
    ]
  ],
  MSFT: [
    ["Microsoft Azure growth accelerates on enterprise AI adoption", "CNBC", 15],
    ["Microsoft raises earnings forecast as cloud division outperforms", "Bloomberg", 11],
    ["Analysts lift MSFT price targets after strong quarterly result", "Barron's", 8],
    ["Microsoft faces EU scrutiny over Teams bundling practices", "Reuters", 5],
    ["Copilot AI integration boosts Office 365 renewal rates", "The Verge", 3],
    ["MSFT stock edges lower amid broad technology sector rotation", "MarketWatch", 1]
  ],
  GOOGL: [
    ["Alphabet advertising revenue beats estimates driving GOOGL rally", "CNBC", 14],
    ["Google Cloud wins major government contracts improving outlook", "Bloomberg", 11],
    ["YouTube subscription growth offsets search revenue headwinds", "The Verge", 8],
    ["Antitrust ruling clouds Alphabet's near-term strategy", "Reuters", 5],
    ["Analysts remain bullish on Alphabet AI monetisation roadmap", "Barron's", 3],
    ["GOOGL slips on disappointing Bard product reception", "MarketWatch", 1]
  ],
  AMZN: [
    ["Amazon Web Services growth reaccelerates beating analyst forecasts", "CNBC", 15],
    ["Prime membership hits new high boosting Amazon revenue diversification", "Bloomberg", 11],
    ["Amazon advertising segment reaches record profitability", "Reuters", 8],
    ["Logistics costs weigh on Amazon retail margin improvement", "The Wall Street Journal", 5],
    ["Analysts hike AMZN targets as cloud competitive position strengthens", "Barron's", 3],
    ["Amazon stock pauses after sharp month-long rally", "MarketWatch", 1]
  ],
  NVDA: [
    ["Nvidia data center revenue smashes records on surging AI demand", "CNBC", 13],
    ["H100 chip backlog extends demand visibility well into next year", "Bloomberg", 10],
    ["NVDA hits all-time high as AI infrastructure spending accelerates", "Reuters", 7],
    ["Analysts warn Nvidia valuation pricing in near-perfect execution", "Barron's", 4],
    ["Competition from AMD and custom silicon poses long-run risk to NVDA", "The Verge", 2],
    ["Nvidia stock retreats on profit-taking after record-breaking quarter", "MarketWatch", 1]
  ],
  META: [
    ["Meta's ad revenue rebounds strongly as Reels monetisation matures", "CNBC", 16],
    ["Reality Labs losses narrow for first time in over a year", "Bloomberg", 12],
    ["Meta AI assistant adoption grows rapidly across WhatsApp and Instagram", "Reuters", 9],
    ["Regulatory pressure mounts on Meta over teen safety practices", "The Wall Street Journal", 6],
    ["Analysts bullish on Meta's year of efficiency bearing fruit", "Barron's", 3],
    ["META edges lower as broader tech sentiment weakens", "MarketWatch", 1]
  ],
  TSLA: [
    ["Tesla delivery numbers beat expectations lifting analyst confidence", "CNBC", 15],
    ["Elon Musk unveils new affordable model boosting retail investor sentiment", "Bloomberg", 11],
    ["Tesla energy storage division posts record quarterly revenue", "Reuters", 8],
    ["Price cuts weigh on Tesla gross margins ahead of earnings", "The Wall Street Journal", 5],
    ["TSLA rally stalls as investors debate long-term autonomous timeline", "Barron's", 3],
    ["Tesla stock drops on disappointing production guidance", "MarketWatch", 1]
  ],
  NFLX: [
    ["Netflix subscriber growth surpasses estimates after ad-tier launch", "CNBC", 14],
    ["Password-sharing crackdown continues to drive incremental sign-ups", "Bloomberg", 10],
    ["Netflix raises prices in key markets improving revenue per user", "Reuters", 7],
    ["Content spending outlook weighs on Netflix free cash flow", "The Wall Street Journal", 4],
    ["Analysts split on whether Netflix ad revenue can scale profitably", "Barron's", 2],
    ["NFLX pulls back after extended post-earnings rally", "MarketWatch", 1]
  ],
  AMD: [
    ["AMD MI300 AI chip order book fills ahead of schedule", "CNBC", 13],
    ["Advanced Micro Devices market share gains in server CPU segment", "Bloomberg", 10],
    ["AMD partners with major hyperscalers for next-gen accelerator supply", "Reuters", 7],
    ["Analysts warn AMD faces execution risk on ambitious roadmap", "Barron's", 4],
    ["AMD stock surges on bullish datacenter spending commentary", "The Verge", 2],
    ["AMD retreats after near-term guidance disappoints investor expectations", "MarketWatch", 1]
  ],
  INTC: [
    ["Intel wins US government foundry contract boosting domestic manufacturing", "CNBC", 16],
    ["INTC restructuring plan reduces costs and improves near-term profitability", "Bloomberg", 12],
    ["Intel 18A process node milestone raises competitive hopes", "Reuters", 9],
    [
      "Market share losses in server CPU segment continue to pressure Intel",
      "The Wall Street Journal",
      6
    ],
    ["Analysts mixed on Intel turnaround timeline and execution ability", "Barron's", 3],
    ["Intel stock falls on weak consumer PC demand outlook", "MarketWatch", 1]
  ],
  JPM: [
    ["JPMorgan posts record quarterly profit on solid investment banking fees", "CNBC", 14],
    ["Jamie Dimon signals cautious macro outlook despite strong results", "Bloomberg", 10],
    ["JPM benefits from higher for longer rate environment expanding NIM", "Reuters", 7],
    [
      "Credit loss provisions rise as consumer credit quality moderates",
      "The Wall Street Journal",
      4
    ],
    ["Analysts maintain overweight on JPMorgan citing fortress balance sheet", "Barron's", 2],
    ["JPM dips as broader financials sector faces profit-taking", "MarketWatch", 1]
  ],
  V: [
    ["Visa reports record cross-border transaction volumes this quarter", "CNBC", 15],
    ["Travel spending recovery continues to lift Visa revenue growth", "Bloomberg", 11],
    ["Visa expands digital wallet partnerships in emerging markets", "Reuters", 8],
    [
      "Regulatory risk around Visa's proposed Discover merger overhang persists",
      "The Wall Street Journal",
      5
    ],
    ["Analysts bullish on Visa long-term given global cashless tailwind", "Barron's", 3],
    ["V stock consolidates after strong multi-week upward trend", "MarketWatch", 1]
  ],
  DIS: [
    ["Disney streaming segment turns profitable ahead of schedule", "CNBC", 14],
    ["ESPN restructuring plan boosts investor confidence in Disney strategy", "Bloomberg", 11],
    ["Disney parks revenue continues to grow driven by international demand", "Reuters", 8],
    [
      "Streaming content costs remain elevated weighing on DIS free cash flow",
      "The Wall Street Journal",
      5
    ],
    ["Board backs Bob Iger's restructuring amid activist investor pressure", "Barron's", 3],
    ["Disney stock slips after mixed quarterly earnings report", "MarketWatch", 1]
  ],
  PYPL: [
    ["PayPal announces share buyback programme lifting investor confidence", "CNBC", 14],
    ["New CEO's strategy update reassures Wall Street on PayPal growth path", "Bloomberg", 10],
    ["PayPal Venmo monetisation accelerates with business account expansion", "Reuters", 7],
    [
      "Competition from Apple Pay and Google Wallet intensifies for PayPal",
      "The Wall Street Journal",
      4
    ],
    ["Analysts cautiously optimistic on PayPal following activist engagement", "Barron's", 2],
    ["PYPL stock falls on weaker than expected active account trends", "MarketWatch", 1]
  ],
  UBER: [
    ["Uber reports first full year of GAAP profitability boosting stock", "CNBC", 15],
    ["Uber Eats market share expands in key international cities", "Bloomberg", 11],
    ["Autonomous vehicle partnerships position Uber for long-term growth", "Reuters", 8],
    ["Driver cost pressures weigh on Uber mobility segment margins", "The Wall Street Journal", 5],
    ["Analysts raise UBER price targets on improved earnings visibility", "Barron's", 3],
    ["Uber stock edges lower amid transport sector rotation", "MarketWatch", 1]
  ]
};

// Generates a stable but unique per-asset seed for mock waves
const assetSeed = (symbol) => {
  let h = 5381;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 33) ^ symbol.charCodeAt(i);
  }
  return Math.abs(h) % 1000;
};

const makeMockNews = (assetConfig, limit = 12) => {
  const rows = headlineBank[assetConfig.symbol] || headlineBank.BTC;
  const now = Date.now();
  const repeated = Array.from({ length: Math.ceil(limit / rows.length) }, () => rows).flat();

  return repeated.slice(0, limit).map(([text, source, minutesAgo], index) => {
    const sentiment = analyzeHeadline(text);

    return {
      _id: `mock-${assetConfig.symbol}-${index}`,
      text,
      source,
      asset: assetConfig.symbol,
      timestamp: new Date(now - minutesAgo * 60 * 1000).toISOString(),
      ...sentiment
    };
  });
};

const makeMockTrend = (assetConfig, minutes = 60) => {
  const now = Date.now();
  const points = [];
  const seed = assetSeed(assetConfig.symbol);

  // Unique phase, period and bias per asset so sentiment_change truly differs
  const phaseOffset = (seed % 30) * 0.21;
  const period = 4 + (seed % 8); // wave period 4–11 minutes
  const microPeriod = 2 + (seed % 5); // micro period 2–6 minutes
  const bias = ((seed % 40) - 20) * 0.006; // -0.12 to +0.12
  const waveScale = 0.12 + (seed % 12) * 0.018;

  for (let index = minutes - 1; index >= 0; index -= 1) {
    const t = minutes - index;
    const wave = Math.sin((t + phaseOffset) / period) * waveScale;
    const micro = Math.cos((t + phaseOffset) / microPeriod) * 0.05;
    const sentiment_avg = Number((bias + wave + micro).toFixed(4));
    const timestamp = new Date(now - index * 60 * 1000).toISOString();

    points.push({
      timestamp,
      sentiment_avg,
      sentiment_percent: Math.round(((sentiment_avg + 1) / 2) * 100),
      count: 3 + (t % 4)
    });
  }

  return points;
};

const makeMockPriceSeries = (assetConfig, minutes = 60) => {
  const now = Date.now();
  const series = [];
  const seed = assetSeed(assetConfig.symbol);
  const phaseOffset = (seed % 25) * 0.25;
  const period = 5 + (seed % 7); // wave period 5–11
  const microPeriod = 3 + (seed % 6); // micro period 3–8
  const trendSlope = ((seed % 40) - 20) * 0.00001; // -0.0002 to +0.0002 drift

  for (let index = minutes - 1; index >= 0; index -= 1) {
    const step = minutes - index;
    const vol = assetConfig.mockVolatility || 0.012;
    const move =
      Math.sin((step + phaseOffset) / period) * vol +
      Math.cos((step + phaseOffset) / microPeriod) * (vol * 0.55) +
      step * trendSlope;
    const price = Number(((assetConfig.mockBase || 100) * (1 + move)).toFixed(2));

    series.push({
      timestamp: new Date(now - index * 60 * 1000).toISOString(),
      price
    });
  }

  return series;
};

module.exports = { makeMockNews, makeMockTrend, makeMockPriceSeries };
