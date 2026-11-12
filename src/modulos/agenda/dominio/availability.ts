import {
  addDays,
  fromBogota,
  getWeekday,
  isBogotaDate,
  toBogotaDate,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { isColombianHoliday } from "@/lib/fechas/festivos";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { BOOKING_WINDOW_DAYS } from "@/modulos/barberias/dominio/policies";
import { toMinutes } from "@/modulos/barberias/dominio/weekly-hours";
import { MAX_BOOKING_MINUTES } from "./booking";

// The availability engine (task 3.1; spec, "Disponibilidad" and "Estados de
// una cita"). Pure: the caller reads the data and passes `now`.
//
// A time is free for a barber when (spec, "La regla central"):
// - the barbershop is open that day: its weekly hours, and on a Colombian
//   holiday only if it opens that holiday (holiday_openings), with the hours
//   of that weekday;
// - the barber works then: the barbershop's hours if usesBarbershopHours,
//   otherwise their own shifts cut to the barbershop's (decision 8 of 2.2);
// - the whole appointment fits inside one shift of both (it never crosses the
//   lunch break);
// - no closure of the barbershop (block without barber) and no block of that
//   barber touches it;
// - it does not touch another appointment of the barber that takes the time
//   (confirmed, attended, no_show; the caller passes only those).
// Every interval is half-open, [start, end), as the database's exclusion
// constraint: an appointment ending at 10:00 leaves 10:00 free.
//
// Slots start every 15 minutes of the Bogotá wall clock (:00, :15, :30, :45),
// at or after now + the minimum notice, on days from today to today + 30 in
// Bogotá, both included (decision 1 of docs/tareas/3.1, provisional).

export const SLOT_STEP_MINUTES = 15;
// barbershops.min_booking_notice_minutes, between 0 and 10080 in the database.
export const MAX_NOTICE_MINUTES = 10_080;

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const SHIFT_TIME = /^(\d{2}):(\d{2})(:00)?$/;

export type Interval = { start: Date; end: Date };

// Active barbers who offer every chosen service (see eligibleBarbers).
export type AvailabilityBarber = {
  id: string;
  sortOrder: number;
  usesBarbershopHours: boolean;
  shifts: readonly WeeklyShift[];
};

// time_blocks: barberId null closes the whole barbershop.
export type TimeBlock = Interval & { barberId: string | null };

// Appointments that take the time: confirmed, attended or no_show.
export type BusyAppointment = Interval & { barberId: string };

export type AvailabilityInput = {
  now: Date;
  // The days to compute, both included; cut to the booking window.
  fromDate: BogotaDate;
  toDate: BogotaDate;
  // The sum of the chosen services (bookingDuration): 5 to 480, steps of 5.
  durationMinutes: number;
  minNoticeMinutes: number;
  shopHours: readonly WeeklyShift[];
  // Holidays the barbershop opens. A date that is not a holiday changes nothing.
  holidayOpenings: readonly BogotaDate[];
  barbers: readonly AvailabilityBarber[];
  blocks: readonly TimeBlock[];
  appointments: readonly BusyAppointment[];
};

// A start time and the barbers free for the whole appointment, ordered by
// sortOrder, then id.
export type Slot = { start: Date; end: Date; barberIds: string[] };
export type DayAvailability = { date: BogotaDate; slots: Slot[] };

// Minutes of the Bogotá wall clock of one day, [start, end).
type Span = { start: number; end: number };
// Epoch milliseconds, [start, end), sorted and without overlaps.
type Busy = { start: number; end: number };

// The days customers may book: today to today + BOOKING_WINDOW_DAYS in
// Bogotá, both included (decision 1, provisional).
export function bookingWindow(now: Date): {
  from: BogotaDate;
  until: BogotaDate;
} {
  const today = toBogotaDate(now);
  return { from: today, until: addDays(today, BOOKING_WINDOW_DAYS) };
}

function invalid(message: string): never {
  throw new RangeError(message);
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

// "09:00" or the database's "09:00:00"; "24:00" is the midnight that ends the
// day. Seconds other than :00 are refused, never cut: cutting a start would
// widen the shift.
function shiftMinutes(time: string): number {
  const match = SHIFT_TIME.exec(time);
  if (!match || Number(match[2]) > 59 || toMinutes(time) > DAY_MINUTES) {
    invalid(`Invalid shift time: ${time}`);
  }
  return toMinutes(time);
}

// The shifts of one weekday as spans, sorted, with the ones that touch joined:
// 9-13 and 13-20 are open 9-20 without a break, as in weekly-hours.ts.
function daySpans(shifts: readonly WeeklyShift[], weekday: number): Span[] {
  const spans = shifts
    .filter((shift) => shift.weekday === weekday)
    .map((shift) => {
      const span = {
        start: shiftMinutes(shift.start),
        end: shiftMinutes(shift.end),
      };
      if (span.end <= span.start) invalid(`Shift ends before it starts`);
      return span;
    })
    .sort((a, b) => a.start - b.start);
  const joined: Span[] = [];
  for (const span of spans) {
    const last = joined.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else joined.push({ ...span });
  }
  return joined;
}

// Where two sorted lists of spans overlap.
function intersect(a: readonly Span[], b: readonly Span[]): Span[] {
  const result: Span[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i]!.start, b[j]!.start);
    const end = Math.min(a[i]!.end, b[j]!.end);
    if (start < end) result.push({ start, end });
    if (a[i]!.end < b[j]!.end) i++;
    else j++;
  }
  return result;
}

// The instant a minute of a Bogotá day stands for; 1440 is the next midnight.
function wallInstant(date: BogotaDate, minutes: number): number {
  if (minutes === DAY_MINUTES) {
    return fromBogota(addDays(date, 1), "00:00").getTime();
  }
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const rest = String(minutes % 60).padStart(2, "0");
  return fromBogota(date, `${hours}:${rest}`).getTime();
}

function toBusy(intervals: readonly Interval[]): Busy[] {
  const sorted = intervals
    .map(({ start, end }) => ({ start: start.getTime(), end: end.getTime() }))
    .sort((a, b) => a.start - b.start);
  const merged: Busy[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

// Whether [start, end) overlaps a busy interval: binary search for the first
// one ending after start.
function overlapsBusy(
  busy: readonly Busy[],
  start: number,
  end: number,
): boolean {
  let low = 0;
  let high = busy.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (busy[middle]!.end <= start) low = middle + 1;
    else high = middle;
  }
  return low < busy.length && busy[low]!.start < end;
}

function byOrder(
  a: { sortOrder: number; id: string },
  b: { sortOrder: number; id: string },
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function validate(input: AvailabilityInput): void {
  const { now, fromDate, toDate, durationMinutes, minNoticeMinutes } = input;
  if (!isValidDate(now)) invalid("Invalid now");
  if (!isBogotaDate(fromDate) || !isBogotaDate(toDate))
    invalid("Invalid dates");
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > MAX_BOOKING_MINUTES ||
    durationMinutes % 5 !== 0
  ) {
    invalid(`Invalid duration: ${durationMinutes}`);
  }
  if (
    !Number.isInteger(minNoticeMinutes) ||
    minNoticeMinutes < 0 ||
    minNoticeMinutes > MAX_NOTICE_MINUTES
  ) {
    invalid(`Invalid minimum notice: ${minNoticeMinutes}`);
  }
  if (!input.holidayOpenings.every(isBogotaDate)) invalid("Invalid holiday");
  const ids = new Set(input.barbers.map((barber) => barber.id));
  if (ids.size !== input.barbers.length) invalid("Repeated barber");
  if (!input.barbers.every((barber) => Number.isFinite(barber.sortOrder))) {
    invalid("Invalid sort order");
  }
  for (const interval of [...input.blocks, ...input.appointments]) {
    if (
      !isValidDate(interval.start) ||
      !isValidDate(interval.end) ||
      interval.end.getTime() <= interval.start.getTime()
    ) {
      invalid("Invalid interval");
    }
  }
}

// The free slots of each day, from fromDate to toDate cut to the booking
// window, in order. A day with nothing free comes with no slots. Throws a
// RangeError on input the database could not have produced.
export function availableSlots(input: AvailabilityInput): DayAvailability[] {
  validate(input);
  const window = bookingWindow(input.now);
  const from = input.fromDate > window.from ? input.fromDate : window.from;
  const until = input.toDate < window.until ? input.toDate : window.until;
  if (from > until) return [];

  const durationMs = input.durationMinutes * MINUTE_MS;
  const earliest = input.now.getTime() + input.minNoticeMinutes * MINUTE_MS;
  const openings = new Set(input.holidayOpenings);
  const barbers = [...input.barbers].sort(byOrder);

  const shopClosures = input.blocks.filter((block) => block.barberId === null);
  const busy = new Map<string, Busy[]>(
    barbers.map((barber) => [
      barber.id,
      toBusy([
        ...shopClosures,
        ...input.blocks.filter((block) => block.barberId === barber.id),
        ...input.appointments.filter((a) => a.barberId === barber.id),
      ]),
    ]),
  );

  const days: DayAvailability[] = [];
  for (let date = from; date <= until; date = addDays(date, 1)) {
    days.push({
      date,
      slots:
        isColombianHoliday(date) && !openings.has(date)
          ? []
          : daySlots(
              date,
              barbers,
              input.shopHours,
              busy,
              durationMs,
              earliest,
            ),
    });
  }
  return days;
}

function daySlots(
  date: BogotaDate,
  barbers: readonly AvailabilityBarber[],
  shopHours: readonly WeeklyShift[],
  busy: ReadonlyMap<string, Busy[]>,
  durationMs: number,
  earliest: number,
): Slot[] {
  const weekday = getWeekday(date);
  const shop = daySpans(shopHours, weekday);
  const slots = new Map<number, Slot>();

  for (const barber of barbers) {
    const spans = barber.usesBarbershopHours
      ? shop
      : intersect(daySpans(barber.shifts, weekday), shop);
    const barberBusy = busy.get(barber.id)!;
    for (const span of spans) {
      const spanEnd = wallInstant(date, span.end);
      const first =
        Math.ceil(span.start / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
      for (let minute = first; minute < span.end; minute += SLOT_STEP_MINUTES) {
        const start = wallInstant(date, minute);
        const end = start + durationMs;
        if (end > spanEnd) break;
        if (start < earliest || overlapsBusy(barberBusy, start, end)) continue;
        const slot = slots.get(start);
        if (slot) slot.barberIds.push(barber.id);
        else {
          slots.set(start, {
            start: new Date(start),
            end: new Date(end),
            barberIds: [barber.id],
          });
        }
      }
    }
  }
  // Barbers were walked in order, so each slot's barberIds already are.
  return [...slots.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

// The instants a barber works one Bogotá day, with the same rules as the
// slots: the barbershop's hours of that weekday (none on a holiday it does
// not open), cut to the barber's own shifts unless usesBarbershopHours.
// Blocks and appointments are not taken out. The owner's agenda (task 4.1)
// draws its free spaces from these.
export function barberWorkingIntervals(
  date: BogotaDate,
  barber: Pick<AvailabilityBarber, "usesBarbershopHours" | "shifts">,
  shopHours: readonly WeeklyShift[],
  holidayOpenings: readonly BogotaDate[],
): Interval[] {
  if (!isBogotaDate(date)) invalid("Invalid date");
  if (isColombianHoliday(date) && !holidayOpenings.includes(date)) return [];
  const weekday = getWeekday(date);
  const shop = daySpans(shopHours, weekday);
  const spans = barber.usesBarbershopHours
    ? shop
    : intersect(daySpans(barber.shifts, weekday), shop);
  return spans.map((span) => ({
    start: new Date(wallInstant(date, span.start)),
    end: new Date(wallInstant(date, span.end)),
  }));
}

// The days with at least one free slot: what the calendar of C-04 enables.
export function availableDays(input: AvailabilityInput): BogotaDate[] {
  return availableSlots(input)
    .filter((day) => day.slots.length > 0)
    .map((day) => day.date);
}

// "El primero disponible" (spec): among the barbers free in the slot, the one
// with the fewest appointments that Bogotá day (the ones that take the time,
// counted on the day they start). Ties go to the lower sortOrder, then the
// lower id (decision 2, provisional), so the answer is always the same.
// Null when nobody is free. `barbers` must include every id of the slot.
export function firstAvailableBarber(
  slot: Pick<Slot, "start" | "barberIds">,
  barbers: readonly Pick<AvailabilityBarber, "id" | "sortOrder">[],
  appointments: readonly Pick<BusyAppointment, "barberId" | "start">[],
): string | null {
  const byId = new Map(barbers.map((barber) => [barber.id, barber]));
  const candidates = slot.barberIds.map(
    (id) => byId.get(id) ?? invalid(`Unknown barber: ${id}`),
  );
  if (candidates.length === 0) return null;

  const date = toBogotaDate(slot.start);
  const counts = new Map<string, number>();
  for (const appointment of appointments) {
    if (toBogotaDate(appointment.start) === date) {
      counts.set(
        appointment.barberId,
        (counts.get(appointment.barberId) ?? 0) + 1,
      );
    }
  }
  const count = (id: string) => counts.get(id) ?? 0;
  return [...candidates].sort(
    (a, b) => count(a.id) - count(b.id) || byOrder(a, b),
  )[0]!.id;
}
