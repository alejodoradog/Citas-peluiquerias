import { addDays, getWeekday } from "./fechas";

// Ley 51 de 1983: these stay on their date even on a weekend.
const FIXED = ["01-01", "05-01", "07-20", "08-07", "12-08", "12-25"];

// Ley 51 de 1983: rest moves to the next Monday unless the date is a Monday.
const MOVED_TO_MONDAY = [
  "01-06",
  "03-19",
  "06-29",
  "08-15",
  "10-12",
  "11-01",
  "11-11",
];

// Days from Easter Sunday: Holy Thursday, Good Friday, Ascension,
// Corpus Christi and Sacred Heart.
const EASTER_OFFSETS = [-3, -2, 43, 64, 71];

// Ley 2578 of June 1, 2026 added the Virgin of Chiquinquirá under the same
// Monday rule. A lawsuit against it is pending at the Corte Constitucional.
const CHIQUINQUIRA = "07-09";
const CHIQUINQUIRA_FIRST_YEAR = 2026;

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

export function getColombianHolidays(year: number): string[] {
  const easter = getEasterSunday(year);
  const moved =
    year >= CHIQUINQUIRA_FIRST_YEAR
      ? [...MOVED_TO_MONDAY, CHIQUINQUIRA]
      : MOVED_TO_MONDAY;

  return [
    ...FIXED.map((monthDay) => `${year}-${monthDay}`),
    ...moved.map((monthDay) => toNextMonday(`${year}-${monthDay}`)),
    ...EASTER_OFFSETS.map((offset) => addDays(easter, offset)),
  ].sort();
}

export function isColombianHoliday(date: string): boolean {
  return getColombianHolidays(Number(date.slice(0, 4))).includes(date);
}
