import { Info } from "lucide-react";

const METHODOLOGY_URL =
  "https://github.com/Rudra-Singhal/Sentitrade/blob/main/METHODOLOGY.md";

const Disclaimer = ({ variant = "full" }) => {
  if (variant === "inline") {
    return (
      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        Educational tool only. Not investment advice and not a recommendation to buy or sell any
        asset. Signals are illustrative and have not been backtested.
      </p>
    );
  }

  return (
    <footer className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-xs leading-5 text-slate-400">
      <div className="flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0 text-slate-500" />
        <p>
          <span className="font-semibold text-slate-300">SentiTrade is an educational project.</span>{" "}
          It compares news sentiment with price movement to describe current conditions. It does{" "}
          <span className="font-semibold text-slate-300">not</span> predict prices, is{" "}
          <span className="font-semibold text-slate-300">not</span> investment advice, and makes no
          recommendation to buy or sell any security or asset. The BUY / SELL / HOLD label is a
          rule-based illustration that has not been backtested.{" "}
          <a
            href={METHODOLOGY_URL}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-cyanline underline-offset-2 hover:underline"
          >
            How this works →
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Disclaimer;
