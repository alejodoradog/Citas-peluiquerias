import { addDays, getWeekday } from "./fechas";

// Each holiday has a stable key; screens name it from src/ui/textos.ts.

// Ley 51 de 1983: these stay on their date even on a weekend.
const FIXED = [
  ["01-01", "new_year"],
  ["05-01", "labor_day"],
  ["07-20", "independence_day"],
  ["08-07", "battle_of_boyaca"],
  ["12-08", "immaculate_conception"],
  ["12-25", "christmas"],
] as const;

// Ley 51 de 1983: rest moves to the next Monday unless the date is a Monday.
const MOVED_TO_MONDAY = [
  ["01-06", "epiphany"],
  ["03-19", "saint_joseph"],
  ["06-29", "saints_peter_and_paul"],
  ["08-15", "assumption"],
  ["10-12", "columbus_day"],
  ["11-01", "all_saints"],
  ["11-11", "cartagena_independence"],
] as const;

// Days from Easter Sunday: Holy Thursday, Good Friday, Ascension,
// Corpus Christi and Sacred Heart.
const EASTER_OFFSETS = [
  [-3, "holy_thursday"],
  [-2, "good_friday"],
  [43, "ascension"],
  [64, "corpus_christi"],
  [71, "sacred_heart"],
] as const;

// Ley 2578 of June 1, 2026 added the Virgin of Chiquinquirá under the same
// Monday rule. A lawsuit against it is pending at the Corte Constitucional.
const CHIQUINQUIRA = ["07-09", "chiquinquira"] as const;
const CHIQUINQUIRA_FIRST_YEAR = 2026;

export type HolidayKey =
  | (typeof FIXED)[number][1]
  | (typeof MOVED_TO_MONDAY)[number][1]
  | (typeof EASTER_OFFSETS)[number][1]
  | (typeof CHIQUINQUIRA)[1];

// One day off. Two holidays can land on the same Monday (Saints Peter and
// Paul and the Sacred Heart in 2025): one date, both keys.
export type Holiday = { date: string; keys: HolidayKey[] };

function toNextMonday(date: string): string {
  const daysUntilMonday = (8 - getWeekday(date)) % 7;
  return addDays(date, daysUntilMonday);
}

// Anonymous Gregorian algorithm.
function getEasterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Every holiday of the year, one entry per holiday, by date (a date shared by
// two holidays appears twice).
function holidaysOf(year: number): Array<{ date: string; key: HolidayKey }> {
  const easter = getEasterSunday(year);
  const moved =
    year >= CHIQUINQUIRA_FIRST_YEAR
      ? [...MOVED_TO_MONDAY, CHIQUINQUIRA]
      : MOVED_TO_MONDAY;

  return [
    ...FIXED.map(([monthDay, key]) => ({ date: `${year}-${monthDay}`, key })),
    ...moved.map(([monthDay, key]) => ({
      date: toNextMonday(`${year}-${monthDay}`),
      key,
    })),
    ...EASTER_OFFSETS.map(([offset, key]) => ({
      date: addDays(easter, offset),
      key,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function getColombianHolidays(year: number): string[] {
  return holidaysOf(year).map((holiday) => holiday.date);
}

// The year's days off with the holidays each one stands for (D-59).
export function getColombianHolidayList(year: number): Holiday[] {
  const list: Holiday[] = [];
  for (const { date, key } of holidaysOf(year)) {
    const last = list.at(-1);
    if (last?.date === date) last.keys.push(key);
    else list.push({ date, keys: [key] });
  }
  return list;
}

export function isColombianHoliday(date: string): boolean {
  return getColombianHolidays(Number(date.slice(0, 4))).includes(date);
}
