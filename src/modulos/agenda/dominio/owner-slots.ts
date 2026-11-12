import type { BogotaDate } from "@/lib/fechas/fechas";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import {
  availableSlots,
  bookingWindow,
  type DayAvailability,
  type Interval,
} from "./availability";
import type {
  AgendaAppointment,
  AgendaBarber,
  AgendaBlock,
  AppointmentStatus,
} from "./owner-agenda";

// Task 4.2: the times the owner can give a manual appointment (D-38) or move
// one to (D-37), and what D-34 lets them do with an appointment. Pure; the
// database checks it all again (migration add_owner_appointment_actions).

const QUARTER_MS = 15 * 60_000;

// The start of the current quarter hour: a walk-in sits down now, so the
// owner may book it (no minimum notice, decision A4 of 4.1).
export function currentQuarter(now: Date): Date {
  return new Date(Math.floor(now.getTime() / QUARTER_MS) * QUARTER_MS);
}

export type OwnerSlotInput = {
  now: Date;
  barber: AgendaBarber;
  durationMinutes: number;
  shopHours: readonly WeeklyShift[];
  holidayOpenings: readonly BogotaDate[];
  appointments: readonly Pick<
    AgendaAppointment,
    "id" | "barberId" | "start" | "end"
  >[];
  blocks: readonly Pick<AgendaBlock, "barberId" | "start" | "end">[];
  // The appointment that moves (D-37) does not take its own time.
  exceptAppointmentId?: string;
};

// The free starts of one barber, today to today + 30 in Bogotá: the engine
// of task 3.1 with no minimum notice and from the current quarter hour. An
// inactive barber takes no new appointments, so has none.
export function ownerSlotDays(input: OwnerSlotInput): DayAvailability[] {
  const window = bookingWindow(input.now);
  if (!input.barber.active) {
    return [];
  }
  return availableSlots({
    now: currentQuarter(input.now),
    fromDate: window.from,
    toDate: window.until,
    durationMinutes: input.durationMinutes,
    minNoticeMinutes: 0,
    shopHours: input.shopHours,
    holidayOpenings: input.holidayOpenings,
    barbers: [
      {
        id: input.barber.id,
        sortOrder: input.barber.sortOrder,
        usesBarbershopHours: input.barber.usesBarbershopHours,
        shifts: input.barber.shifts,
      },
    ],
    blocks: input.blocks,
    appointments: input.appointments
      .filter(
        (a) =>
          a.barberId === input.barber.id && a.id !== input.exceptAppointmentId,
      )
      .map((a) => ({ barberId: a.barberId, start: a.start, end: a.end })),
  });
}

export type AppointmentActions = {
  // D-35: attended or no-show, once it started, and corrected later.
  mark: boolean;
  // D-36 and D-37: only a confirmed appointment.
  cancel: boolean;
  reschedule: boolean;
  // The pencil of D-34: confirmed or attended (spec, "agregar la barba en la
  // silla").
  editServices: boolean;
};

export function appointmentActions(
  appointment: { status: AppointmentStatus; start: Date },
  now: Date,
): AppointmentActions {
  const { status } = appointment;
  const started = appointment.start.getTime() <= now.getTime();
  const takesTime =
    status === "confirmed" || status === "attended" || status === "no_show";
  return {
    mark: takesTime && started,
    cancel: status === "confirmed",
    reschedule: status === "confirmed",
    editServices: status === "confirmed" || status === "attended",
  };
}

// The appointments that take the time of a block (D-39): the barber's, or
// anyone's for the whole barbershop (barberId null). The block cannot be
// made until they move or are cancelled.
export function appointmentsInBlock<
  T extends Pick<AgendaAppointment, "barberId" | "start" | "end">,
>(appointments: readonly T[], barberId: string | null, block: Interval): T[] {
  return appointments.filter(
    (a) =>
      (barberId === null || a.barberId === barberId) &&
      a.start.getTime() < block.end.getTime() &&
      block.start.getTime() < a.end.getTime(),
  );
}

// D-34 says what just changed: "?hecho=attended" after the owner's action.
export const DONE_PARAM = "hecho";
export const DONE_CODES = [
  "attended",
  "no_show",
  "cancelled",
  "rescheduled",
  "services",
  "created",
] as const;
export type DoneCode = (typeof DONE_CODES)[number];

export function parseDone(value: unknown): DoneCode | null {
  return typeof value === "string" &&
    (DONE_CODES as readonly string[]).includes(value)
    ? (value as DoneCode)
    : null;
}
