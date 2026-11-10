import {
  addDays,
  fromBogota,
  isBogotaDate,
  toBogotaDate,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import type { ParseResult } from "@/lib/validacion/parse";
import { TIME_OPTIONS } from "./weekly-hours";

// Special closures of the whole barbershop (D-59; spec, time_blocks without
// barber: "cierres especiales"). Rules of decision P8 of task 2.4,
// provisional:
// - whole days, or from one hour to another, possibly over several days;
// - at most 31 days long;
// - only ones that have not ended yet (one that already started, such as the
//   rest of today, is fine);
// - hours every 15 minutes, in Bogotá; a closure may end at midnight;
// - an optional reason of up to 200 characters, the column's check.
// Appointments already taken inside a closure stay (task 4.1 will warn).

export const MAX_CLOSURE_DAYS = 31;
export const MAX_REASON_LENGTH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// "Desde" offers 00:00 to 23:45; "Hasta", 00:15 to 24:00, the midnight that
// ends the day.
export const END_OF_DAY = "24:00";
export const CLOSURE_START_TIMES: readonly string[] = TIME_OPTIONS;
export const CLOSURE_END_TIMES: readonly string[] = [
  ...TIME_OPTIONS.slice(1),
  END_OF_DAY,
];

export type ClosureField =
  "fromDate" | "toDate" | "allDay" | "fromTime" | "toTime" | "reason";

// - closure_date_invalid: not a date.
// - closure_time_invalid: not one of the hours offered.
// - closure_order: it does not end after it starts.
// - closure_past: it already ended.
// - closure_too_long: longer than MAX_CLOSURE_DAYS.
// - closure_reason_too_long: a reason over MAX_REASON_LENGTH characters.
export type ClosureErrorCode =
  | "closure_date_invalid"
  | "closure_time_invalid"
  | "closure_order"
  | "closure_past"
  | "closure_too_long"
  | "closure_reason_too_long";

export type Closure = { startsAt: Date; endsAt: Date; reason: string | null };

// An instant from a Bogotá date and one of the closure hours, 24:00 included.
function instant(date: string, time: string): Date {
  return time === END_OF_DAY
    ? fromBogota(addDays(date, 1), "00:00")
    : fromBogota(date, time);
}

// The sheet "Agregar cierre" as sent: dates "2026-12-24", allDay "on" when
// the switch is on, hours "14:00" (ignored for whole days).
export function parseClosureForm(
  input: Record<ClosureField, string>,
  now: Date,
): ParseResult<Closure, ClosureErrorCode> {
  const errors: Partial<Record<ClosureField, ClosureErrorCode>> = {};
  const allDay = input.allDay === "on";

  if (!isBogotaDate(input.fromDate)) errors.fromDate = "closure_date_invalid";
  if (!isBogotaDate(input.toDate)) errors.toDate = "closure_date_invalid";
  if (!allDay) {
    if (!CLOSURE_START_TIMES.includes(input.fromTime)) {
      errors.fromTime = "closure_time_invalid";
    }
    if (!CLOSURE_END_TIMES.includes(input.toTime)) {
      errors.toTime = "closure_time_invalid";
    }
  }
  const reason = input.reason.trim();
  // Characters as Postgres counts them (char_length), not UTF-16 units.
  if (Array.from(reason).length > MAX_REASON_LENGTH) {
    errors.reason = "closure_reason_too_long";
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };

  const startsAt = allDay
    ? fromBogota(input.fromDate, "00:00")
    : instant(input.fromDate, input.fromTime);
  let endsAt: Date;
  try {
    endsAt = allDay
      ? fromBogota(addDays(input.toDate, 1), "00:00")
      : instant(input.toDate, input.toTime);
  } catch {
    // The day after 9999-12-31 has no date of its own.
    return { success: false, errors: { toDate: "closure_date_invalid" } };
  }
  // Where the owner fixes it: the end date, or the end hour of the same day.
  const endField =
    allDay || input.toDate < input.fromDate ? "toDate" : "toTime";

  const error: ClosureErrorCode | null =
    endsAt.getTime() <= startsAt.getTime()
      ? "closure_order"
      : endsAt.getTime() <= now.getTime()
        ? "closure_past"
        : endsAt.getTime() - startsAt.getTime() > MAX_CLOSURE_DAYS * DAY_MS
          ? "closure_too_long"
          : null;
  if (error) {
    const field = error === "closure_too_long" ? "toDate" : endField;
    return { success: false, errors: { [field]: error } };
  }

  return {
    success: true,
    data: { startsAt, endsAt, reason: reason === "" ? null : reason },
  };
}

// How D-59 reads a closure, in Bogotá. The copy is in src/ui/textos.ts.
// - day / days: whole days, the last one included;
// - from: from an hour to the end of the day ("desde 2:00 p. m.");
// - until: from the start of the day to an hour ("hasta 11:00 a. m.");
// - between: two hours of one day;
// - span: anything else, an end at midnight read as 24:00 of the day before.
export type ClosureSpan =
  | { kind: "day"; date: string }
  | { kind: "days"; from: string; to: string }
  | { kind: "from"; date: string; time: string }
  | { kind: "until"; date: string; time: string }
  | { kind: "between"; date: string; from: string; to: string }
  | {
      kind: "span";
      from: { date: string; time: string };
      to: { date: string; time: string };
    };

export function describeClosure(startsAt: Date, endsAt: Date): ClosureSpan {
  const startDate = toBogotaDate(startsAt);
  const startTime = toBogotaTime(startsAt);
  const endDate = toBogotaDate(endsAt);
  const endTime = toBogotaTime(endsAt);
  const endsAtMidnight = endTime === "00:00";
  // The day the closure ends in, and when on it.
  const lastDate = endsAtMidnight ? addDays(endDate, -1) : endDate;
  const lastTime = endsAtMidnight ? END_OF_DAY : endTime;

  if (startTime === "00:00" && endsAtMidnight) {
    return lastDate === startDate
      ? { kind: "day", date: startDate }
      : { kind: "days", from: startDate, to: lastDate };
  }
  if (lastDate === startDate) {
    if (endsAtMidnight) {
      return { kind: "from", date: startDate, time: startTime };
    }
    if (startTime === "00:00") {
      return { kind: "until", date: startDate, time: endTime };
    }
    return { kind: "between", date: startDate, from: startTime, to: endTime };
  }
  return {
    kind: "span",
    from: { date: startDate, time: startTime },
    to: { date: lastDate, time: lastTime },
  };
}
