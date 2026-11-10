import { addDays, isBogotaDate } from "@/lib/fechas/fechas";
import { getColombianHolidayList, type Holiday } from "@/lib/fechas/festivos";

// Holidays of Colombia a barbershop opens (D-59; spec, "Festivos de Colombia
// precargados; la barbería decide si abre"). They are closed by default; each
// row of holiday_openings opens one with that weekday's hours.

// D-59 lists the next 12 months, today included (decision P7 of task 2.4,
// provisional). Dates are calendar days in Bogotá ("2026-11-16").
export const HOLIDAY_WINDOW_DAYS = 365;

export type HolidayWindow = { from: string; until: string };

export function holidayWindow(today: string): HolidayWindow {
  return { from: today, until: addDays(today, HOLIDAY_WINDOW_DAYS - 1) };
}

// The holidays from one date to another, both included.
export function upcomingHolidays(from: string, until: string): Holiday[] {
  const holidays: Holiday[] = [];
  for (
    let year = Number(from.slice(0, 4));
    year <= Number(until.slice(0, 4));
    year++
  ) {
    for (const holiday of getColombianHolidayList(year)) {
      if (holiday.date >= from && holiday.date <= until) holidays.push(holiday);
    }
  }
  return holidays;
}

// D-59 sends one date per holiday switched on; a year has about 20.
const MAX_SENT_DATES = 60;

// - valid: the holidays to open in the window, sorted, without repeats. A
//   holiday already past (the page was opened before midnight) is dropped:
//   the window no longer reaches it, so its row stays as it was.
// - malformed: anything D-59 could not have sent (a day that is not a
//   holiday, a date after the window, not a date at all): tampered.
export type HolidayOpeningsResult =
  { status: "valid"; dates: string[] } | { status: "malformed" };

export function parseHolidayOpenings(
  sent: readonly unknown[],
  window: HolidayWindow,
): HolidayOpeningsResult {
  if (sent.length > MAX_SENT_DATES) return { status: "malformed" };
  const holidays = new Set(
    upcomingHolidays(window.from, window.until).map((holiday) => holiday.date),
  );
  const dates = new Set<string>();
  for (const value of sent) {
    if (typeof value !== "string" || !isBogotaDate(value)) {
      return { status: "malformed" };
    }
    if (value < window.from) continue;
    if (!holidays.has(value)) return { status: "malformed" };
    dates.add(value);
  }
  return { status: "valid", dates: [...dates].sort() };
}
