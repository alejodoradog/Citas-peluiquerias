import {
  addDays,
  isBogotaDate,
  startOfBogotaDay,
  toBogotaTime,
  fromBogota,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { ParseResult } from "@/lib/validacion/parse";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { barberWorkingIntervals, type Interval } from "./availability";
import {
  appointmentLook,
  takesTime,
  type AppointmentLook,
  type AppointmentStatus,
} from "./owner-agenda";

// "Mi agenda" of a barber (task 4.4): B-01 to B-04, from what the link's
// functions return (migration add_barber_agenda). The database already
// leaves out prices, contact data and other barbers; these rules only order
// and word what is left.

// The days a barber can open (decision B5): a week back, to mark what they
// forgot, and the 30 days customers can book ahead.
export const DAYS_BACK = 7;
export const DAYS_AHEAD = 30;
const QUARTER_MS = 15 * 60_000;

export type BarberAppointment = Interval & {
  id: string;
  status: AppointmentStatus;
  source: "web" | "manual";
  createdAt: Date;
  // Already short ("Camila R."): the database never sends the full name.
  customerName: string;
  serviceNames: readonly string[];
};

export type BarberBlock = Interval & {
  id: string;
  // False for a closure of the whole barbershop: the barber cannot remove it.
  own: boolean;
  reason: string | null;
};

export type BarberAgendaData = {
  barber: { id: string; name: string; active: boolean };
  // writable: the barbershop is active. Otherwise B-06, read only.
  barbershop: { name: string; writable: boolean };
  schedule: { usesBarbershopHours: boolean; shifts: readonly WeeklyShift[] };
  shopHours: readonly WeeklyShift[];
  holidayOpenings: readonly BogotaDate[];
  appointments: readonly BarberAppointment[];
  blocks: readonly BarberBlock[];
};

export type BarberView = "dia" | "semana";
export type BarberQuery = { view: BarberView; date: BogotaDate };

// ?vista=semana and ?dia=YYYY-MM-DD. A day outside the window, or anything
// that is not a date, opens today.
export function parseBarberQuery(
  params: Record<string, string | string[] | undefined>,
  today: BogotaDate,
): BarberQuery {
  const view: BarberView = params.vista === "semana" ? "semana" : "dia";
  const day = params.dia;
  const date =
    typeof day === "string" &&
    isBogotaDate(day) &&
    day >= addDays(today, -DAYS_BACK) &&
    day <= addDays(today, DAYS_AHEAD)
      ? day
      : today;
  return { view, date };
}

// Decisions B2 and B3: a confirmed appointment that already started. A mark
// is not corrected from the link, and nobody marks "no asistió" to someone
// who has not arrived yet.
export function canMark(
  appointment: Pick<BarberAppointment, "status" | "start">,
  now: Date,
): boolean {
  return (
    appointment.status === "confirmed" &&
    appointment.start.getTime() <= now.getTime()
  );
}

export type BarberDayItem =
  | {
      kind: "appointment";
      id: string;
      start: Date;
      end: Date;
      appointment: BarberAppointment;
      look: AppointmentLook;
      markable: boolean;
    }
  | {
      kind: "block";
      id: string;
      start: Date;
      end: Date;
      block: BarberBlock;
      removable: boolean;
    };

function overlapsDay(interval: Interval, date: BogotaDate): boolean {
  const start = startOfBogotaDay(date).getTime();
  const end = startOfBogotaDay(addDays(date, 1)).getTime();
  return interval.start.getTime() < end && interval.end.getTime() > start;
}

// B-01: the appointments that take time and the blocks of one day, in order.
export function dayItems(
  data: BarberAgendaData,
  date: BogotaDate,
  now: Date,
): BarberDayItem[] {
  const appointments = data.appointments
    .filter((item) => takesTime(item.status) && overlapsDay(item, date))
    .map((appointment): BarberDayItem => ({
      kind: "appointment",
      id: appointment.id,
      start: appointment.start,
      end: appointment.end,
      appointment,
      look: appointmentLook(appointment, now),
      markable: canMark(appointment, now),
    }));
  const blocks = data.blocks
    .filter((item) => overlapsDay(item, date))
    .map((block): BarberDayItem => ({
      kind: "block",
      id: block.id,
      start: block.start,
      end: block.end,
      block,
      // Decision B4: their own blocks that have not ended.
      removable:
        data.barbershop.writable &&
        block.own &&
        block.end.getTime() > now.getTime(),
    }));
  return [...appointments, ...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id),
  );
}

// "Hoy tienes 4 citas · la próxima a las 10:40 a. m.": the appointments of
// today that take time, and the first confirmed one still to start.
export function todaySummary(
  data: BarberAgendaData,
  today: BogotaDate,
  now: Date,
): { count: number; next: Date | null } {
  const todays = data.appointments.filter(
    (item) => takesTime(item.status) && overlapsDay(item, today),
  );
  const next = todays
    .filter(
      (item) =>
        item.status === "confirmed" && item.start.getTime() > now.getTime(),
    )
    .map((item) => item.start)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return { count: todays.length, next: next ?? null };
}

export type BarberWeekDay = {
  date: BogotaDate;
  // From the first hour the barber works to the last ("9:00 a. m. – 7:00
  // p. m."), or null when they do not work ("Descansas").
  hours: { start: string; end: string } | null;
  count: number;
};

// B-02: each day of the week with the barber's hours, by the same rules as
// the booking engine, and how many appointments it has.
export function weekDays(
  data: BarberAgendaData,
  days: readonly BogotaDate[],
): BarberWeekDay[] {
  return days.map((date) => {
    const intervals = barberWorkingIntervals(
      date,
      data.schedule,
      data.shopHours,
      data.holidayOpenings,
    );
    const first = intervals[0];
    const last = intervals.at(-1);
    return {
      date,
      hours:
        first && last
          ? { start: toBogotaTime(first.start), end: endTime(last.end, date) }
          : null,
      count: data.appointments.filter(
        (item) => takesTime(item.status) && overlapsDay(item, date),
      ).length,
    };
  });
}

// The end of a working day as a wall clock time; midnight is "24:00".
function endTime(end: Date, date: BogotaDate): string {
  return end.getTime() >= startOfBogotaDay(addDays(date, 1)).getTime()
    ? "24:00"
    : toBogotaTime(end);
}

// B-04 --------------------------------------------------------------------------------------------

export const BLOCK_REASONS = ["lunch", "leave", "errand", "other"] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

// The days of the "Día" picker: today to DAYS_AHEAD.
export function blockDayOptions(today: BogotaDate): BogotaDate[] {
  return Array.from({ length: DAYS_AHEAD + 1 }, (_, index) =>
    addDays(today, index),
  );
}

// Every quarter hour of a day, "00:00" to "23:45".
export function blockTimeOptions(): string[] {
  return Array.from({ length: 96 }, (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, "0");
    const minutes = String((index % 4) * 15).padStart(2, "0");
    return `${hours}:${minutes}`;
  });
}

export type BlockField = "dia" | "desde" | "hasta" | "motivo";
export type BlockFormCode = "end_before_start" | "in_the_past";
export type BlockRequest = { start: Date; end: Date; reason: BlockReason };

const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

// The form of B-04, checked again by the database.
export function parseBlockForm(
  input: Record<BlockField, string>,
  today: BogotaDate,
  now: Date,
): ParseResult<BlockRequest, BlockFormCode> {
  const errors: Partial<Record<BlockField, BlockFormCode | "invalid">> = {};
  const dayOk =
    isBogotaDate(input.dia) &&
    input.dia >= today &&
    input.dia <= addDays(today, DAYS_AHEAD);
  if (!dayOk) errors.dia = "invalid";
  if (!QUARTER_TIME.test(input.desde)) errors.desde = "invalid";
  if (!QUARTER_TIME.test(input.hasta)) errors.hasta = "invalid";
  if (!(BLOCK_REASONS as readonly string[]).includes(input.motivo)) {
    errors.motivo = "invalid";
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };

  const start = fromBogota(input.dia, input.desde);
  const end = fromBogota(input.dia, input.hasta);
  if (end.getTime() <= start.getTime()) {
    return { success: false, errors: { hasta: "end_before_start" } };
  }
  const currentQuarter = Math.floor(now.getTime() / QUARTER_MS) * QUARTER_MS;
  if (start.getTime() < currentQuarter) {
    return { success: false, errors: { desde: "in_the_past" } };
  }
  return {
    success: true,
    data: { start, end, reason: input.motivo as BlockReason },
  };
}
