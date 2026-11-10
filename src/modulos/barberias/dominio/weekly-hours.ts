import type { WeeklyShift } from "./hours";

// A barber's own weekly hours (D-55, decision 8 of task 2.2): up to two shifts
// a day, times every 15 minutes, a day without shifts is a day off, and every
// shift fits inside the barbershop's hours of that day. The availability
// engine of task 3.1 crosses both again; this is what the owner can save.

export const MAX_SHIFTS_PER_DAY = 2;
const STEP_MINUTES = 15;

// Days in the order the screen shows them: Monday first, Sunday last.
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export type Weekday = (typeof WEEK_DAYS)[number];

// "00:00", "00:15" … "23:45": what "Desde" and "Hasta" offer.
export const TIME_OPTIONS: readonly string[] = Array.from(
  { length: (24 * 60) / STEP_MINUTES },
  (_, index) => fromMinutes(index * STEP_MINUTES),
);
const VALID_TIMES = new Set(TIME_OPTIONS);

// One code per day, the first rule it breaks:
// - hours_invalid: a time that is not one of TIME_OPTIONS.
// - hours_too_many: more than two shifts.
// - hours_order: a shift that does not end after it starts.
// - hours_overlap: two shifts of the day overlap.
// - hours_outside_shop: a shift goes beyond the barbershop's hours that day.
export type WeekErrorCode =
  | "hours_invalid"
  | "hours_too_many"
  | "hours_order"
  | "hours_overlap"
  | "hours_outside_shop";

export type DayErrors = Partial<Record<Weekday, WeekErrorCode>>;

// The form field each day's error is keyed by ("day1" is Monday).
export type DayField = `day${Weekday}`;
export function dayField(weekday: Weekday): DayField {
  return `day${weekday}`;
}

// - valid: the shifts to save, by day and start.
// - invalid: what is wrong with each day.
// - malformed: not a week the screen could have sent (tampered or broken).
export type WeekFormResult =
  | { status: "valid"; shifts: WeeklyShift[] }
  | { status: "invalid"; errors: DayErrors }
  | { status: "malformed" };

// The screen sends at most 2 shifts for each of 7 days; anything far beyond
// that did not come from it.
const MAX_INPUT_SHIFTS = 28;

export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function fromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function isWeekday(value: unknown): value is Weekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

function byStart(a: { start: string }, b: { start: string }): number {
  return a.start.localeCompare(b.start);
}

function sortWeek(shifts: readonly WeeklyShift[]): WeeklyShift[] {
  return [...shifts].sort(
    (a, b) =>
      WEEK_DAYS.indexOf(a.weekday as Weekday) -
        WEEK_DAYS.indexOf(b.weekday as Weekday) || byStart(a, b),
  );
}

function dayError(
  shifts: ReadonlyArray<{ start: string; end: string }>,
): WeekErrorCode | null {
  if (shifts.some((s) => !VALID_TIMES.has(s.start) || !VALID_TIMES.has(s.end)))
    return "hours_invalid";
  if (shifts.length > MAX_SHIFTS_PER_DAY) return "hours_too_many";
  if (shifts.some((s) => s.start >= s.end)) return "hours_order";
  const sorted = [...shifts].sort(byStart);
  // Half-open, as in the database: 9-12 and 12-18 do not overlap.
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.start < sorted[i - 1]!.end) return "hours_overlap";
  }
  return null;
}

// Reads the week the screen sends (JSON already parsed): an array of
// { weekday, start, end }. Checks each day on its own; the barbershop's hours
// are checked by validateWeek.
export function parseWeekForm(input: unknown): WeekFormResult {
  if (!Array.isArray(input) || input.length > MAX_INPUT_SHIFTS) {
    return { status: "malformed" };
  }
  const shifts: WeeklyShift[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null)
      return { status: "malformed" };
    const { weekday, start, end, ...rest } = item as Record<string, unknown>;
    if (
      Object.keys(rest).length > 0 ||
      !isWeekday(weekday) ||
      typeof start !== "string" ||
      typeof end !== "string"
    ) {
      return { status: "malformed" };
    }
    shifts.push({ weekday, start, end });
  }

  const errors: DayErrors = {};
  for (const weekday of WEEK_DAYS) {
    const error = dayError(shifts.filter((s) => s.weekday === weekday));
    if (error) errors[weekday] = error;
  }
  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  return { status: "valid", shifts: sortWeek(shifts) };
}

// The barbershop's shifts of a day, with the ones that touch joined (9-13 and
// 13-20 are open 9-20 without a break).
function openSpans(shop: readonly WeeklyShift[], weekday: number) {
  const spans: Array<{ start: string; end: string }> = [];
  for (const shift of shop.filter((s) => s.weekday === weekday).sort(byStart)) {
    const last = spans.at(-1);
    if (last && shift.start <= last.end) {
      if (shift.end > last.end) last.end = shift.end;
    } else {
      spans.push({ start: shift.start, end: shift.end });
    }
  }
  return spans;
}

// The days, Monday first, with a shift that does not fit whole inside the
// barbershop's hours of that same day (a closed day fits nothing).
export function daysOutsideShop(
  shifts: readonly WeeklyShift[],
  shop: readonly WeeklyShift[],
): Weekday[] {
  return WEEK_DAYS.filter((weekday) => {
    const spans = openSpans(shop, weekday);
    return shifts
      .filter((s) => s.weekday === weekday)
      .some(
        (s) =>
          !spans.some((span) => span.start <= s.start && s.end <= span.end),
      );
  });
}

export function isWithinShop(
  shifts: readonly WeeklyShift[],
  shop: readonly WeeklyShift[],
): boolean {
  return daysOutsideShop(shifts, shop).length === 0;
}

// Everything the server checks before saving: each day, then the barbershop.
export function validateWeek(
  input: unknown,
  shop: readonly WeeklyShift[],
): WeekFormResult {
  const parsed = parseWeekForm(input);
  if (parsed.status !== "valid") return parsed;
  const outside = daysOutsideShop(parsed.shifts, shop);
  if (outside.length === 0) return parsed;
  return {
    status: "invalid",
    errors: Object.fromEntries(
      outside.map((weekday) => [weekday, "hours_outside_shop"]),
    ),
  };
}

// The p_shifts argument of set_barber_schedule: [{ weekday, start, end }].
export function toRpcShifts(
  shifts: readonly WeeklyShift[],
): Array<{ weekday: number; start: string; end: string }> {
  return sortWeek(shifts).map(({ weekday, start, end }) => ({
    weekday,
    start,
    end,
  }));
}

// The screen's model ---------------------------------------------------------------

export type DayShift = { start: string; end: string };

// A day of the editor. Turning "Trabaja" off keeps its shifts, so turning it
// back on brings them back; only working days are saved.
export type DayDraft = { works: boolean; shifts: DayShift[] };
export type WeekDraft = Record<Weekday, DayDraft>;

// A day that starts working without shifts of its own.
export const DEFAULT_DAY_SHIFT: DayShift = { start: "09:00", end: "18:00" };

// The editor's week from saved shifts: at most two a day, by start.
export function draftFromShifts(shifts: readonly WeeklyShift[]): WeekDraft {
  const entries = WEEK_DAYS.map((weekday) => {
    const day = shifts
      .filter((s) => s.weekday === weekday)
      .map(({ start, end }) => ({
        start: start.slice(0, 5),
        end: end.slice(0, 5),
      }))
      .sort(byStart)
      .slice(0, MAX_SHIFTS_PER_DAY);
    return [weekday, { works: day.length > 0, shifts: day }] as const;
  });
  return Object.fromEntries(entries) as WeekDraft;
}

// What the editor sends: the shifts of the working days.
export function shiftsFromDraft(draft: WeekDraft): WeeklyShift[] {
  return WEEK_DAYS.flatMap((weekday) => {
    const day = draft[weekday];
    return day.works
      ? day.shifts.map(({ start, end }) => ({ weekday, start, end }))
      : [];
  });
}

// "Partir la jornada": one shift becomes two with an hour's break in the
// middle (9-20 → 9-14 and 15-20). A shift too short to split keeps its place
// and the second one starts 15 minutes after it, for the owner to adjust.
export function splitShift(shift: DayShift): [DayShift, DayShift] {
  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end);
  const last = 24 * 60 - STEP_MINUTES;
  if (end - start >= 2 * 60) {
    const middle = Math.round((start + end) / 2 / STEP_MINUTES) * STEP_MINUTES;
    return [
      { start: shift.start, end: fromMinutes(middle - 30) },
      { start: fromMinutes(middle + 30), end: shift.end },
    ];
  }
  const secondStart = Math.min(end + STEP_MINUTES, last);
  return [
    shift,
    {
      start: fromMinutes(secondStart),
      end: fromMinutes(Math.min(secondStart + 60, last)),
    },
  ];
}
