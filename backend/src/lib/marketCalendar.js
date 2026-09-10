/**
 * Lightweight US-equity session calendar. Not exhaustive — enough to tell
 * "regular session" from "closed" so stock prices can be labelled `live`
 * vs `delayed` (last close). A full exchange calendar is a later concern.
 */

// NYSE/Nasdaq full-day holidays (YYYY-MM-DD, observed). Extend yearly.
const HOLIDAYS = new Set([
  // 2025
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25"
]);

/** Parts of `date` in America/New_York. */
const nyParts = (date) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
};

const isWeekend = (date) => {
  const { weekday } = nyParts(date);
  return weekday === "Sat" || weekday === "Sun";
};

const isMarketHoliday = (date) => HOLIDAYS.has(nyParts(date).ymd);

/** Regular trading session: Mon–Fri, 09:30–16:00 ET, not a holiday. */
const isUsEquityMarketOpen = (date = new Date()) => {
  if (isWeekend(date) || isMarketHoliday(date)) return false;
  const { minutes } = nyParts(date);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
};

module.exports = { isUsEquityMarketOpen, isMarketHoliday, isWeekend };
