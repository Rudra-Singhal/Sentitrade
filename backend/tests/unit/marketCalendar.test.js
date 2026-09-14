const {
  isUsEquityMarketOpen,
  isMarketHoliday,
  isWeekend
} = require("../../src/lib/marketCalendar");

// Fixed instants (UTC). ET = UTC-5 (winter) / UTC-4 (summer).
const at = (iso) => new Date(iso);

describe("marketCalendar", () => {
  it("is open on a weekday inside 09:30-16:00 ET", () => {
    // 2026-03-04 is a Wednesday. 15:00 UTC = 10:00 ET (EST).
    expect(isUsEquityMarketOpen(at("2026-03-04T15:00:00Z"))).toBe(true);
  });

  it("is closed before the open and after the close", () => {
    expect(isUsEquityMarketOpen(at("2026-03-04T13:00:00Z"))).toBe(false); // 08:00 ET
    expect(isUsEquityMarketOpen(at("2026-03-04T22:00:00Z"))).toBe(false); // 17:00 ET
  });

  it("is closed at the weekend", () => {
    expect(isWeekend(at("2026-03-07T15:00:00Z"))).toBe(true); // Saturday
    expect(isUsEquityMarketOpen(at("2026-03-07T15:00:00Z"))).toBe(false);
  });

  it("knows a listed holiday", () => {
    expect(isMarketHoliday(at("2026-12-25T15:00:00Z"))).toBe(true);
    expect(isUsEquityMarketOpen(at("2026-12-25T15:00:00Z"))).toBe(false);
  });
});
