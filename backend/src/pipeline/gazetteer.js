const { LIST } = require("../services/assetService");

// Bare tickers that are also common English words or too short to trust — these
// only resolve on a `$cashtag` or a real name/alias match, never a bare hit.
const AMBIGUOUS = new Set(["V", "T", "F", "GE", "GM", "GS", "MA", "OP", "HAL", "SUI", "ITC", "LT"]);

const build = () => {
  const map = {};
  for (const cfg of LIST) {
    const terms = Array.from(
      new Set(
        [cfg.symbol, cfg.displayName, ...(cfg.aliases || [])]
          .filter(Boolean)
          .map((t) => t.toLowerCase())
      )
    );
    const strongTerms = Array.from(
      new Set(
        [cfg.displayName, ...(cfg.aliases || [])]
          .filter(Boolean)
          .map((t) => t.toLowerCase())
          .filter((t) => t !== cfg.symbol.toLowerCase())
      )
    );
    map[cfg.symbol] = {
      symbol: cfg.symbol,
      name: cfg.displayName,
      type: cfg.type,
      cashtag: `$${cfg.symbol.toLowerCase()}`,
      terms,
      strongTerms,
      ambiguous: AMBIGUOUS.has(cfg.symbol) || cfg.symbol.length <= 1
    };
  }
  return map;
};

const GAZETTEER = build();

module.exports = { GAZETTEER };
