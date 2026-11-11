import {
  addDays,
  getWeekday,
  isBogotaDate,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { isColombianHoliday } from "@/lib/fechas/festivos";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { toMinutes } from "@/modulos/barberias/dominio/weekly-hours";
import { MAX_SERVICES_PER_BOOKING } from "./booking";

// The public booking flow (tasks 3.2 and 3.3, C-02 to C-07). Its state lives
// in the URL, so "atrás" works and a link can be shared:
// /<slug>/reservar?servicios=<id>&servicios=<id>&barbero=<id|primero>
//   &dia=2026-11-24&hora=10:30&paso=datos
// Everything in the URL is untrusted: anything that is not well formed is
// dropped, and the database checks the booking again.

export const FIRST_AVAILABLE = "primero";

export const BOOKING_STEPS = ["servicios", "barbero", "hora", "datos"] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

export type BookingSelection = {
  serviceIds: string[];
  // A barber id or FIRST_AVAILABLE.
  barber: string | null;
  date: BogotaDate | null;
  time: string | null;
  step: BookingStep;
  // C-07: the time someone else took while the customer filled the form.
  taken: string | null;
};

export type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function one(value: string | string[] | undefined): string | null {
  const values = all(value);
  return values.length === 1 ? values[0]! : null;
}

function time(value: string | null): string | null {
  return value !== null && QUARTER_TIME.test(value) ? value : null;
}

// The step the URL asks for, or the first one whose choice is missing.
export function readBookingParams(params: SearchParams): BookingSelection {
  const serviceIds = [
    ...new Set(all(params.servicios).map((id) => id.toLowerCase())),
  ].filter(isUuid);
  const barberParam = one(params.barbero)?.toLowerCase() ?? null;
  const barber =
    barberParam === FIRST_AVAILABLE ||
    (barberParam !== null && isUuid(barberParam))
      ? barberParam
      : null;
  const dateParam = one(params.dia);
  const date = dateParam !== null && isBogotaDate(dateParam) ? dateParam : null;
  const chosenTime = date ? time(one(params.hora)) : null;

  const services =
    serviceIds.length >= 1 && serviceIds.length <= MAX_SERVICES_PER_BOOKING
      ? serviceIds
      : [];
  const reached: BookingStep =
    services.length === 0
      ? "servicios"
      : barber === null
        ? "barbero"
        : chosenTime === null
          ? "hora"
          : "datos";
  const asked = one(params.paso);
  const askedIndex = BOOKING_STEPS.indexOf(asked as BookingStep);
  const step =
    askedIndex >= 0 && askedIndex < BOOKING_STEPS.indexOf(reached)
      ? BOOKING_STEPS[askedIndex]!
      : reached;

  return {
    serviceIds: services,
    barber: services.length > 0 ? barber : null,
    date: services.length > 0 && barber !== null ? date : null,
    time: services.length > 0 && barber !== null ? chosenTime : null,
    step,
    taken: time(one(params.tomada)),
  };
}

// The query of a selection, without the empty parts. Each step links with
// what the customer chose before it and nothing after it.
export function bookingQuery(selection: {
  serviceIds?: readonly string[];
  barber?: string | null;
  date?: BogotaDate | null;
  time?: string | null;
  step?: BookingStep;
  taken?: string | null;
}): string {
  const query = new URLSearchParams();
  for (const id of selection.serviceIds ?? []) query.append("servicios", id);
  if (selection.barber) query.set("barbero", selection.barber);
  if (selection.date) query.set("dia", selection.date);
  if (selection.time) query.set("hora", selection.time);
  if (selection.step) query.set("paso", selection.step);
  if (selection.taken) query.set("tomada", selection.taken);
  const text = query.toString();
  return text ? `?${text}` : "";
}

// C-04 groups the times as "Mañana", "Tarde" and "Noche".
export type DayPart = "morning" | "afternoon" | "evening";

export function dayPart(wallTime: string): DayPart {
  const minutes = toMinutes(wallTime);
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "evening";
}

// "Abierto hoy · 9:00 a. m. – 8:00 p. m." of C-01: from the first opening to
// the last closing of that day, or null when it does not open (a closed
// weekday, or a holiday it does not open).
export function openingOf(
  date: BogotaDate,
  shopHours: readonly WeeklyShift[],
  holidayOpenings: readonly BogotaDate[],
): { start: string; end: string } | null {
  if (isColombianHoliday(date) && !holidayOpenings.includes(date)) return null;
  const weekday = getWeekday(date);
  const shifts = shopHours
    .filter((shift) => shift.weekday === weekday)
    .map((shift) => ({
      start: shift.start.slice(0, 5),
      end: shift.end.slice(0, 5),
    }));
  if (shifts.length === 0) return null;
  return {
    start: shifts.map((s) => s.start).sort()[0]!,
    end: shifts
      .map((s) => s.end)
      .sort()
      .at(-1)!,
  };
}

// The weekly hours of C-01, Monday first: consecutive days with the same
// shifts in one row ("Lunes a viernes"), closed days with no shifts.
export type WeekRow = {
  fromDay: number;
  toDay: number;
  shifts: { start: string; end: string }[];
};

export function weekRows(shopHours: readonly WeeklyShift[]): WeekRow[] {
  const rows: WeekRow[] = [];
  let lastKey: string | null = null;
  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    const shifts = shopHours
      .filter((shift) => shift.weekday === weekday)
      .map((shift) => ({
        start: shift.start.slice(0, 5),
        end: shift.end.slice(0, 5),
      }))
      .sort((a, b) => a.start.localeCompare(b.start));
    const key = shifts.map((s) => `${s.start}-${s.end}`).join(",");
    const last = rows.at(-1);
    if (last && key === lastKey) last.toDay = weekday;
    else rows.push({ fromDay: weekday, toDay: weekday, shifts });
    lastKey = key;
  }
  return rows;
}

// The days of the strip of C-04: today to the end of the booking window.
export function windowDays(from: BogotaDate, until: BogotaDate): BogotaDate[] {
  const days: BogotaDate[] = [];
  for (let date = from; date <= until; date = addDays(date, 1)) {
    days.push(date);
  }
  return days;
}
