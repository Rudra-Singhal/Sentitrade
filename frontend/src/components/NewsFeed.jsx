import Card from "./Card.jsx";
import DataSourceBadge from "./DataSourceBadge.jsx";
import { Newspaper } from "lucide-react";
import { DATA_SOURCE } from "../lib/dataSource.js";

const tagClasses = {
  positive: "border-neon/30 bg-neon/10 text-neon",
  neutral: "border-warning/30 bg-warning/10 text-warning",
  negative: "border-danger/30 bg-danger/10 text-danger"
};

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(timestamp)
  );

const NewsFeed = ({ items = [], loading, source }) => (
  <Card className="p-5">
    <div className="mb-4 flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Headlines
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">Market Tape</h2>
        <DataSourceBadge source={source} className="mt-2" />
      </div>
      <Newspaper className="text-cyanline" size={20} />
    </div>

    <div className="max-h-[350px] space-y-3 overflow-y-auto pr-1">
      {loading &&
        Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg bg-white/[0.055]" />
        ))}

      {!loading && items.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
          {source === DATA_SOURCE.UNAVAILABLE
            ? "Live headlines are unavailable right now."
            : "No headlines for this asset in the selected window."}
        </p>
      )}

      {!loading &&
        items.map((item) => (
          <article
            key={item._id || `${item.text}-${item.timestamp}`}
            className="rounded-lg border border-white/8 bg-black/20 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-slate-500">{item.source}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${
                  tagClasses[item.sentiment_label] || tagClasses.neutral
                }`}
              >
                {item.sentiment_label}
              </span>
            </div>
            <p className="text-sm font-medium leading-5 text-slate-200">{item.text}</p>
            <p className="mt-2 text-xs text-slate-600">{formatTime(item.timestamp)}</p>
          </article>
        ))}
    </div>
  </Card>
);

export default NewsFeed;
