import { useState, useRef, useEffect } from "react";
import { Bitcoin, TrendingUp, ChevronDown, Check } from "lucide-react";

const AssetSelector = ({ assets, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selectedAsset = assets.find((a) => a.symbol === selected) || assets[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cryptos = assets.filter((a) => a.type === "crypto");
  const stocks  = assets.filter((a) => a.type === "stock");

  const Icon = selectedAsset?.type === "crypto" ? Bitcoin : TrendingUp;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition min-w-[130px] justify-between ${
          open
            ? "border-neon/70 bg-neon/15 text-neon shadow-glow"
            : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/25 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon size={14} />
          {selectedAsset?.symbol}
          <span className="hidden sm:inline text-slate-400 font-normal">
            · {selectedAsset?.displayName}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`ml-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 top-12 z-50 w-56 rounded-xl border border-white/10 bg-[#0f1117] shadow-2xl ring-1 ring-black/40 overflow-hidden animate-fade-in">
          {/* Crypto section */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Crypto
            </p>
          </div>
          {cryptos.map((asset) => (
            <DropdownItem
              key={asset.symbol}
              asset={asset}
              active={selected === asset.symbol}
              onSelect={() => { onChange(asset.symbol); setOpen(false); }}
            />
          ))}

          {/* Divider */}
          <div className="mx-3 my-2 border-t border-white/8" />

          {/* Stocks section */}
          <div className="px-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Stocks
            </p>
          </div>
          {stocks.map((asset) => (
            <DropdownItem
              key={asset.symbol}
              asset={asset}
              active={selected === asset.symbol}
              onSelect={() => { onChange(asset.symbol); setOpen(false); }}
            />
          ))}
          <div className="h-2" />
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
        active
          ? "bg-neon/10 text-neon"
          : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon size={13} className={active ? "text-neon" : "text-slate-500"} />
      <span className="font-semibold">{asset.symbol}</span>
      <span className="ml-auto text-xs text-slate-500 font-normal">{asset.displayName}</span>
      {active && <Check size={12} className="text-neon shrink-0" />}
    </button>
  );
};

export default AssetSelector;
