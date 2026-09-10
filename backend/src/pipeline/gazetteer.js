const { ASSETS } = require("../services/assetService");

/**
 * Per-asset name variants for entity resolution against free text.
 * Not exhaustive — a maintained gazetteer with misspellings and richer
 * slang can grow over time. `cashtag` is the ticker with a leading `$`.
 *
 * `ambiguous: true` means the bare ticker is a common English word or too
 * short to trust — such assets only resolve on a cashtag or a name match.
 */
const EXTRA = {
  BTC: { aliases: ["bitcoin", "btc"], slang: ["the king", "orange coin"] },
  ETH: { aliases: ["ethereum", "ether", "eth"], people: ["vitalik buterin", "vitalik"] },
  SOL: { aliases: ["solana", "sol"] },
  BNB: { aliases: ["bnb", "binance coin", "binance smart chain", "bsc"] },
  XRP: { aliases: ["xrp", "ripple"] },

  AAPL: {
    aliases: ["apple", "aapl"],
    products: ["iphone", "ipad", "vision pro", "app store"],
    people: ["tim cook"]
  },
  MSFT: {
    aliases: ["microsoft", "msft"],
    products: ["azure", "windows", "office 365", "copilot"],
    people: ["satya nadella"]
  },
  GOOGL: {
    aliases: ["alphabet", "google", "googl"],
    products: ["youtube", "google cloud", "android", "gemini"],
    people: ["sundar pichai"]
  },
  AMZN: {
    aliases: ["amazon", "amzn"],
    products: ["aws", "prime", "alexa"],
    people: ["andy jassy"]
  },
  NVDA: {
    aliases: ["nvidia", "nvda"],
    products: ["h100", "blackwell", "cuda"],
    people: ["jensen huang"],
    slang: ["team green"]
  },
  META: {
    aliases: ["meta platforms", "facebook", "instagram", "whatsapp"],
    people: ["mark zuckerberg"],
    ambiguous: true
  },
  TSLA: {
    aliases: ["tesla", "tsla"],
    products: ["cybertruck", "model 3", "full self driving", "fsd"],
    people: ["elon musk"]
  },
  NFLX: { aliases: ["netflix", "nflx"] },
  AMD: {
    aliases: ["advanced micro devices", "amd"],
    products: ["ryzen", "epyc", "mi300"],
    people: ["lisa su"]
  },
  INTC: { aliases: ["intel", "intc"], products: ["core ultra", "18a"] },
  JPM: { aliases: ["jpmorgan", "jpmorgan chase", "jpm"], people: ["jamie dimon"] },
  V: { aliases: ["visa"], ambiguous: true },
  DIS: {
    aliases: ["disney", "walt disney", "dis"],
    products: ["disney+", "espn"],
    people: ["bob iger"]
  },
  PYPL: { aliases: ["paypal", "pypl", "venmo"] },
  UBER: { aliases: ["uber", "uber eats"] }
};

const build = () => {
  const map = {};
  for (const symbol of Object.keys(ASSETS)) {
    const cfg = ASSETS[symbol];
    const extra = EXTRA[symbol] || {};
    const terms = new Set(
      [
        symbol,
        cfg.displayName,
        ...(extra.aliases || []),
        ...(extra.products || []),
        ...(extra.people || []),
        ...(extra.slang || [])
      ]
        .filter(Boolean)
        .map((t) => t.toLowerCase())
    );
    map[symbol] = {
      symbol,
      name: cfg.displayName,
      type: cfg.type,
      cashtag: `$${symbol.toLowerCase()}`,
      terms: Array.from(terms),
      strongTerms: Array.from(
        new Set(
          [cfg.displayName, ...(extra.aliases || []).filter((a) => a !== symbol.toLowerCase())]
            .filter(Boolean)
            .map((t) => t.toLowerCase())
        )
      ),
      ambiguous: Boolean(extra.ambiguous) || symbol.length <= 1
    };
  }
  return map;
};

const GAZETTEER = build();

module.exports = { GAZETTEER };
