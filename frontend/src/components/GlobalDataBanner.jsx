import { AlertTriangle, FlaskConical } from "lucide-react";
import { DATA_SOURCE } from "../lib/dataSource.js";

/**
 * Shown whenever any panel is not backed by live/cached real data, so the
 * user is never misled by the real TradingView chart sitting next to
 * simulated or missing numbers.
 */
const GlobalDataBanner = ({ worst }) => {
  if (worst === DATA_SOURCE.SIMULATED) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        <FlaskConical size={18} className="shrink-0" />
        <p className="font-semibold">
          Demo mode — some panels below show <span className="underline">simulated</span> data, not
          real market data. Configure live data sources to see real values.
        </p>
      </div>
    );
  }

  if (worst === DATA_SOURCE.UNAVAILABLE) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        <AlertTriangle size={18} className="shrink-0" />
        <p className="font-semibold">
          Live data is currently unavailable for one or more panels. Values are shown as “—” rather
          than estimated.
        </p>
      </div>
    );
  }

  if (worst === DATA_SOURCE.DELAYED || worst === DATA_SOURCE.CACHED) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-cyanline/25 bg-cyanline/10 px-4 py-3 text-sm text-cyanline">
        <AlertTriangle size={18} className="shrink-0" />
        <p className="font-semibold">Some data is delayed or cached rather than live.</p>
      </div>
    );
  }

  return null;
};

export default GlobalDataBanner;
