import { useState, useRef, useEffect } from "react";
import { Bitcoin, TrendingUp, ChevronDown, Check } from "lucide-react";

const GROUPS = [
  { key: "crypto", label: "Crypto", match: (a) => a.type === "crypto" },
  { key: "us", label: "US Stocks", match: (a) => a.type === "stock" && a.exchange !== "NSE" },
  { key: "nse", label: "India (NSE)", match: (a) => a.type === "stock" && a.exchange === "NSE" }
];

const AssetSelector = ({ assets, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const selectedAsset = assets.find((a) => a.symbol === selected) || assets[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? assets.filter(
        (a) => a.symbol.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q)
      )
    : assets;

  const Icon = selectedAsset?.type === "crypto" ? Bitcoin : TrendingUp;

  const pick = (symbol) => {
    onChange(symbol);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 min-w-[130px] items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
          open
            ? "border-neon/70 bg-neon/15 text-neon shadow-glow"
            : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon size={14} />
          {selectedAsset?.symbol}
          <span className="hidden font-normal text-slate-400 sm:inline">
            · {selectedAsset?.displayName}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`ml-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-fade-in absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#0f1117] shadow-2xl ring-1 ring-black/40">
          <div className="border-b border-white/8 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets…"
              className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-neon/50"
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {GROUPS.map((group) => {
              const rows = filtered.filter(group.match);
              if (!rows.length) return null;
              return (
                <div key={group.key}>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    {group.label}
                  </p>
                  {rows.map((asset) => (
                    <DropdownItem
                      key={asset.symbol}
                      asset={asset}
                      active={selected === asset.symbol}
                      onSelect={() => pick(asset.symbol)}
                    />
                  ))}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-slate-500">No matches</p>
            )}
            <div className="h-2" />
          </div>
        </div>
      )}
    </div>
  );
};

const DropdownItem = ({ asset, active, onSelect }) => {
  const Icon = asset.type === "crypto" ? Bitcoin : TrendingUp;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition ${
        active ? "bg-neon/10 text-neon" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon size={13} className={active ? "text-neon" : "text-slate-500"} />
      <span className="font-semibold">{asset.symbol}</span>
      <span className="ml-auto truncate text-xs font-normal text-slate-500">
        {asset.displayName}
      </span>
      {active && <Check size={12} className="shrink-0 text-neon" />}
    </button>
  );
};

export default AssetSelector;
