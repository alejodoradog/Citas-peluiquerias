import {
  addDays,
  fromBogota,
  getWeekday,
  isBogotaDate,
  toBogotaDate,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { isId } from "@/modulos/barberias/dominio/service";
import { barberWorkingIntervals, type Interval } from "./availability";

// The owner's agenda (task 4.1, D-30 to D-33): what each barber has on a
// Bogotá day, and how full each day of a week is. Pure: the caller reads the
// data with the owner's session and passes `now`.
//
// - Only the appointments that take the time are drawn: confirmed, attended
//   and no_show (spec, "Estados de una cita"). Cancelled ones free the space
//   and the design does not draw them (decision A2).
// - A free space is time the barber works (the same rules as the booking
//   engine, barberWorkingIntervals) with no appointment and no block, from
//   now on (decision A4). An inactive barber has none: they take no new
//   appointments (spec, "Disponibilidad").
// Every interval is half-open, [start, end), as in the database.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
// Free spaces start on a whole 5 minutes: services last multiples of 5.
const FREE_STEP_MINUTES = 5;
// "Nueva" (decision A3, provisional): a web booking of the last 24 hours that
// is still confirmed.
export const NEW_BOOKING_HOURS = 24;

export type AgendaView = "dia" | "semana";

// What the URL of the agenda says (decision A6): ?vista=semana, ?dia=
// YYYY-MM-DD and ?barbero=<id>. Anything else falls back to today, the day
// view and every barber, so an old or edited link never breaks the page.
export type AgendaQuery = {
  view: AgendaView;
  date: BogotaDate;
  barberId: string | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseAgendaQuery(
  query: SearchParams,
  today: BogotaDate,
): AgendaQuery {
  const view = single(query.vista) === "semana" ? "semana" : "dia";
  const day = single(query.dia);
  const barber = single(query.barbero);
  return {
    view,
    date: day !== undefined && isBogotaDate(day) ? day : today,
    barberId: isId(barber) ? barber : null,
  };
}

export type AgendaBarber = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  usesBarbershopHours: boolean;
  shifts: readonly WeeklyShift[];
};

export type AppointmentStatus =
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop";

export type AgendaAppointment = Interval & {
  id: string;
  barberId: string;
  status: AppointmentStatus;
  source: "web" | "manual";
  createdAt: Date;
  customerName: string;
  serviceNames: readonly string[];
};

export type AgendaBlock = Interval & {
  id: string;
  // Null closes the whole barbershop (a special closure, D-59).
  barberId: string | null;
  reason: string | null;
};

export type AgendaData = {
  barbers: readonly AgendaBarber[];
  shopHours: readonly WeeklyShift[];
  holidayOpenings: readonly BogotaDate[];
  appointments: readonly AgendaAppointment[];
  blocks: readonly AgendaBlock[];
};

// How a card looks: the states of F-01. "manual" is a confirmed appointment
// the barbershop created (D-30 draws it grey, "· manual").
export type AppointmentLook =
  "new" | "confirmed" | "manual" | "attended" | "no_show";

const TAKES_TIME: ReadonlySet<AppointmentStatus> = new Set([
  "confirmed",
  "attended",
  "no_show",
]);

export function takesTime(status: AppointmentStatus): boolean {
  return TAKES_TIME.has(status);
}

export function appointmentLook(
  appointment: Pick<AgendaAppointment, "status" | "source" | "createdAt">,
  now: Date,
): AppointmentLook {
  if (appointment.status === "attended") return "attended";
  if (appointment.status === "no_show") return "no_show";
  if (appointment.source === "manual") return "manual";
  const age = now.getTime() - appointment.createdAt.getTime();
  return age >= 0 && age < NEW_BOOKING_HOURS * HOUR_MS ? "new" : "confirmed";
}

// "Luis García" → "Luis G.", "Juan" → "Juan" (D-30, D-31): the first name and
// the initial of the next word, so a column fits it.
export function shortCustomerName(fullName: string): string {
  const [first, second] = fullName.trim().split(/\s+/).filter(Boolean);
  if (!first) return "";
  if (!second) return first;
  return `${first} ${[...second][0]!.toLocaleUpperCase("es-CO")}.`;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

// The Monday to Sunday of the week of a day (D-32 goes "2 – 8 de noviembre").
export function weekOf(date: BogotaDate): BogotaDate[] {
  const monday = addDays(date, -((getWeekday(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// The barbers the agenda shows, in the team's order: the active ones, and an
// inactive one only while they have appointments in the range, so the owner
// still sees (and can reassign) them (decision A5).
export function shownBarbers(
  barbers: readonly AgendaBarber[],
  appointments: readonly Pick<AgendaAppointment, "barberId" | "status">[],
): AgendaBarber[] {
  const busy = new Set(
    appointments.filter((a) => takesTime(a.status)).map((a) => a.barberId),
  );
  return barbers
    .filter((barber) => barber.active || busy.has(barber.id))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "es-CO") ||
        (a.id < b.id ? -1 : 1),
    );
}

function dayBounds(date: BogotaDate): Interval {
  return {
    start: fromBogota(date, "00:00"),
    end: fromBogota(addDays(date, 1), "00:00"),
  };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function clip(interval: Interval, to: Interval): Interval {
  return {
    start: interval.start < to.start ? to.start : interval.start,
    end: interval.end > to.end ? to.end : interval.end,
  };
}

// The parts of `from` that no busy interval covers.
function subtract(from: Interval, busy: readonly Interval[]): Interval[] {
  const sorted = [...busy]
    .filter((b) => overlaps(b, from))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: Interval[] = [];
  let cursor = from.start.getTime();
  for (const b of sorted) {
    if (b.start.getTime() > cursor) {
      result.push({ start: new Date(cursor), end: b.start });
    }
    cursor = Math.max(cursor, b.end.getTime());
  }
  if (cursor < from.end.getTime()) {
    result.push({ start: new Date(cursor), end: from.end });
  }
  return result;
}

function ceilToStep(instant: Date, minutes: number): Date {
  const step = minutes * MINUTE_MS;
  return new Date(Math.ceil(instant.getTime() / step) * step);
}

export type AgendaItem =
  | {
      kind: "appointment";
      start: Date;
      end: Date;
      appointment: AgendaAppointment;
      look: AppointmentLook;
    }
  | {
      kind: "block";
      start: Date;
      end: Date;
      id: string;
      reason: string | null;
      wholeShop: boolean;
    }
  | { kind: "free"; start: Date; end: Date };

export type BarberDay = {
  barber: AgendaBarber;
  // When the barber works that day, blocks and appointments included.
  working: Interval[];
  // Appointments, blocks and free spaces, by start; appointments and blocks
  // first when they start together.
  items: AgendaItem[];
};

const ITEM_ORDER = { appointment: 0, block: 1, free: 2 } as const;

// One barber's Bogotá day (a column of D-30, the list of D-31).
export function barberDay(
  date: BogotaDate,
  barber: AgendaBarber,
  data: Omit<AgendaData, "barbers">,
  now: Date,
): BarberDay {
  const day = dayBounds(date);
  const working = barberWorkingIntervals(
    date,
    barber,
    data.shopHours,
    data.holidayOpenings,
  );
  const appointments = data.appointments.filter(
    (a) => a.barberId === barber.id && takesTime(a.status) && overlaps(a, day),
  );
  const blocks = data.blocks
    .filter(
      (b) =>
        (b.barberId === null || b.barberId === barber.id) && overlaps(b, day),
    )
    .map((b) => ({ ...b, ...clip(b, day) }));

  const items: AgendaItem[] = [
    ...appointments.map((appointment) => ({
      kind: "appointment" as const,
      start: appointment.start,
      end: appointment.end,
      appointment,
      look: appointmentLook(appointment, now),
    })),
    ...blocks.map((block) => ({
      kind: "block" as const,
      start: block.start,
      end: block.end,
      id: block.id,
      reason: block.reason,
      wholeShop: block.barberId === null,
    })),
  ];

  if (barber.active) {
    const notBefore = ceilToStep(now, FREE_STEP_MINUTES);
    const busy = [...appointments, ...blocks];
    for (const span of working) {
      if (span.end <= notBefore) continue;
      const from = span.start < notBefore ? notBefore : span.start;
      for (const free of subtract({ start: from, end: span.end }, busy)) {
        const start = ceilToStep(free.start, FREE_STEP_MINUTES);
        if (
          free.end.getTime() - start.getTime() >=
          FREE_STEP_MINUTES * MINUTE_MS
        ) {
          items.push({ kind: "free", start, end: free.end });
        }
      }
    }
  }

  items.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      ITEM_ORDER[a.kind] - ITEM_ORDER[b.kind],
  );
  return { barber, working, items };
}

// The tappable pieces of a free space in the grid of D-30 (decision A4): cut
// at each whole hour, so tapping near an hour starts the new appointment
// there, with a piece shorter than `minMinutes` joined to its neighbour. A
// free space shorter than that has no piece: drawn to scale it would be too
// small to tap, and D-31 lists it.
export function splitAtHours(interval: Interval, minMinutes = 30): Interval[] {
  const min = minMinutes * MINUTE_MS;
  const length = (piece: Interval) =>
    piece.end.getTime() - piece.start.getTime();
  const pieces: Interval[] = [];
  let start = interval.start;
  while (start < interval.end) {
    const nextHour = new Date(
      (Math.floor(start.getTime() / HOUR_MS) + 1) * HOUR_MS,
    );
    const end = nextHour < interval.end ? nextHour : interval.end;
    pieces.push({ start, end });
    start = end;
  }
  const joined: Interval[] = [];
  for (const piece of pieces) {
    const last = joined.at(-1);
    if (last && (length(last) < min || length(piece) < min)) {
      last.end = piece.end;
    } else {
      joined.push({ ...piece });
    }
  }
  return joined.filter((piece) => length(piece) >= min);
}

// The whole hours the grid of D-30 covers: from the earliest work or
// appointment of any column to the latest, or null when nobody works and
// nothing is booked (the day is closed). Blocks alone do not stretch it: a
// closure of the whole day would draw 24 hours.
export function gridHours(
  date: BogotaDate,
  days: readonly BarberDay[],
): { from: Date; until: Date } | null {
  const spans: Interval[] = days.flatMap((day) => [
    ...day.working,
    ...day.items.filter((item) => item.kind === "appointment"),
  ]);
  if (spans.length === 0) return null;
  const day = dayBounds(date);
  const first = Math.min(...spans.map((s) => s.start.getTime()));
  const last = Math.max(...spans.map((s) => s.end.getTime()));
  // Bogotá is UTC-5 all year, so whole hours of UTC are whole hours there.
  const from = Math.max(
    day.start.getTime(),
    Math.floor(first / HOUR_MS) * HOUR_MS,
  );
  const until = Math.min(
    day.end.getTime(),
    Math.ceil(last / HOUR_MS) * HOUR_MS,
  );
  return from < until ? { from: new Date(from), until: new Date(until) } : null;
}

export type WeekDaySummary = {
  date: BogotaDate;
  // Appointments that take the time and start that day, of the shown barbers.
  count: number;
  perBarber: { barberId: string; name: string; count: number }[];
  // Booked minutes over worked minutes, 0 to 1 (decision A7).
  occupancy: number;
  // Nobody works and nothing is booked.
  closed: boolean;
};

// The days of D-32.
export function weekSummary(
  days: readonly BogotaDate[],
  barbers: readonly AgendaBarber[],
  data: Omit<AgendaData, "barbers">,
): WeekDaySummary[] {
  return days.map((date) => {
    let workedMs = 0;
    let bookedMs = 0;
    const perBarber = barbers.map((barber) => {
      const working = barberWorkingIntervals(
        date,
        barber,
        data.shopHours,
        data.holidayOpenings,
      );
      workedMs += working.reduce(
        (sum, span) => sum + span.end.getTime() - span.start.getTime(),
        0,
      );
      const own = data.appointments.filter(
        (a) =>
          a.barberId === barber.id &&
          takesTime(a.status) &&
          toBogotaDate(a.start) === date,
      );
      for (const appointment of own) {
        for (const span of working) {
          if (overlaps(appointment, span)) {
            const part = clip(appointment, span);
            bookedMs += part.end.getTime() - part.start.getTime();
          }
        }
      }
      return { barberId: barber.id, name: barber.name, count: own.length };
    });
    const count = perBarber.reduce((sum, b) => sum + b.count, 0);
    return {
      date,
      count,
      perBarber,
      occupancy: workedMs > 0 ? Math.min(1, bookedMs / workedMs) : 0,
      closed: workedMs === 0 && count === 0,
    };
  });
}
