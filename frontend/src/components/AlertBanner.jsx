import { BellRing, CircleAlert } from "lucide-react";
import { isRealSource } from "../lib/dataSource.js";

/**
 * Describes when news tone crosses a high or low threshold. Deliberately
 * worded as a description of current conditions, not a prediction or a
 * call to action. Hidden unless the underlying data is real.
 */
const AlertBanner = ({ sentiment }) => {
  if (!isRealSource(sentiment?.data_source)) return null;

  const score = sentiment?.score_percent ?? 50;

  if (score < 35) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-danger">
        <CircleAlert size={18} />
        <p className="text-sm font-semibold">News tone is currently below 35% (negative).</p>
      </div>
    );
  }

  if (score > 68) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neon/25 bg-neon/10 px-4 py-3 text-neon">
        <BellRing size={18} />
        <p className="text-sm font-semibold">News tone is currently above 68% (positive).</p>
      </div>
    );
  }

  return null;
};

export default AlertBanner;
