/**
 * Lightweight equity session calendars (US + India/NSE). Not exhaustive —
 * enough to label prices `live` vs `delayed` (last close). Full exchange
 * calendars are a later concern.
 */

// NYSE/Nasdaq full-day holidays (observed). Extend yearly.
const US_HOLIDAYS = new Set([
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

// NSE full-day holidays (partial — the major ones). Extend yearly.
const NSE_HOLIDAYS = new Set([
  "2025-01-26",
  "2025-02-26",
  "2025-03-14",
  "2025-03-31",
  "2025-04-10",
  "2025-04-14",
  "2025-04-18",
  "2025-05-01",
  "2025-08-15",
  "2025-08-27",
  "2025-10-02",
  "2025-10-21",
  "2025-10-22",
  "2025-11-05",
  "2025-12-25",
  "2026-01-26",
  "2026-03-04",
  "2026-03-25",
  "2026-04-01",
  "2026-04-14",
  "2026-05-01",
  "2026-08-15",
  "2026-10-02",
  "2026-11-11",
  "2026-12-25"
]);

const EXCHANGES = {
  US: { tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60, holidays: US_HOLIDAYS },
  NSE: { tz: "Asia/Kolkata", open: 9 * 60 + 15, close: 15 * 60 + 30, holidays: NSE_HOLIDAYS }
};

const partsIn = (date, tz) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    minutes: Number(p.hour === "24" ? 0 : p.hour) * 60 + Number(p.minute)
  };
};

/** Is the given (or default US) exchange in a regular trading session right now? */
const isMarketOpen = (exchange = "US", date = new Date()) => {
  const ex = EXCHANGES[exchange] || EXCHANGES.US;
  const { ymd, weekday, minutes } = partsIn(date, ex.tz);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (ex.holidays.has(ymd)) return false;
  return minutes >= ex.open && minutes < ex.close;
};

// Back-compat
const isUsEquityMarketOpen = (date) => isMarketOpen("US", date);
const isMarketHoliday = (date, exchange = "US") =>
  (EXCHANGES[exchange] || EXCHANGES.US).holidays.has(
    partsIn(date, (EXCHANGES[exchange] || EXCHANGES.US).tz).ymd
  );
const isWeekend = (date, exchange = "US") => {
  const { weekday } = partsIn(date, (EXCHANGES[exchange] || EXCHANGES.US).tz);
  return weekday === "Sat" || weekday === "Sun";
};

module.exports = { isMarketOpen, isUsEquityMarketOpen, isMarketHoliday, isWeekend };
