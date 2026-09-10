import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { GitCompareArrows, MoveDownRight, MoveUpRight } from "lucide-react";

const signalClasses = {
  BUY: "border-neon/25 bg-neon/10 text-neon",
  SELL: "border-danger/25 bg-danger/10 text-danger",
  HOLD: "border-warning/25 bg-warning/10 text-warning"
};

const strengthLabel = {
  low: "weak alignment",
  moderate: "moderate alignment",
  high: "strong alignment"
};

const pct = (value) => (value === null || value === undefined ? "—" : `${value}%`);

const CorrelationBox = ({ data, summary }) => {
  const sentimentChange = data?.sentiment_change ?? null;
  const priceChange = data?.price_change ?? null;
  const sentimentPositive = (sentimentChange ?? 0) >= 0;
  const pricePositive = (priceChange ?? 0) >= 0;
  const SentimentIcon = sentimentPositive ? MoveUpRight : MoveDownRight;
  const PriceIcon = pricePositive ? MoveUpRight : MoveDownRight;
  const signal = data?.signal;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sentiment vs price</p>
          <h2 className="mt-1 text-xl font-bold text-white">This window</h2>
          <DataSourceBadge source={data?.data_source} className="mt-2" />
        </div>
        <GitCompareArrows size={20} className="text-neon" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <SentimentIcon size={16} />
            <span className="text-xs font-semibold uppercase">News tone Δ</span>
          </div>
          <p className={`text-2xl font-bold ${sentimentChange === null ? "text-slate-500" : sentimentPositive ? "text-neon" : "text-danger"}`}>
            {pct(sentimentChange)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <PriceIcon size={16} />
            <span className="text-xs font-semibold uppercase">Price Δ</span>
          </div>
          <p className={`text-2xl font-bold ${priceChange === null ? "text-slate-500" : pricePositive ? "text-neon" : "text-danger"}`}>
            {pct(priceChange)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-cyanline/20 bg-cyanline/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-cyanline">{data?.insight || "Waiting for data"}</p>
          {signal?.signal ? (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-extrabold ${
                signalClasses[signal.signal] || signalClasses.HOLD
              }`}
            >
              {signal.signal} · {strengthLabel[signal.strength] || "weak alignment"}
            </span>
          ) : null}
        </div>
        {summary ? <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p> : null}
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          {data?.note || "Describes co-movement this window. Not a predictive correlation."}
        </p>
      </div>
    </Card>
  );
};

export default CorrelationBox;
