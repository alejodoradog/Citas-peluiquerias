import { isBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";

// "Cierre del día" (task 4.6, D-64; spec, function 17): what a barbershop
// attended in one Bogotá day, in whole pesos, and the barbers' commission.
// The money is what each line of an appointment copied from its service when
// it was booked (decision C7), so a later price change never alters a close.

export type CloseStatus =
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop";

export type CloseAppointment = {
  barberId: string;
  status: CloseStatus;
  lines: readonly { priceCop: number }[];
};

export type CloseBarber = {
  id: string;
  name: string;
  // The owner who also cuts ("Yo también corto"): never a commission (C2).
  isOwner: boolean;
  sortOrder: number;
};

export type BarberClose = {
  barberId: string;
  name: string;
  // Services attended (decision C5), not appointments.
  attended: number;
  totalCop: number;
  // null for the owner who cuts, or while the barbershop has none (C1).
  commissionCop: number | null;
};

export type DayClose = {
  totalCop: number;
  servicesAttended: number;
  noShows: number;
  // Confirmed appointments nobody has marked yet (decision C6).
  pending: number;
  byBarber: BarberClose[];
};

// The commission of a total, rounded to the peso, half a peso up.
export function commissionOf(totalCop: number, percent: number): number {
  return Math.floor((totalCop * percent + 50) / 100);
}

export function dayClose(input: {
  appointments: readonly CloseAppointment[];
  barbers: readonly CloseBarber[];
  commissionPercent: number;
}): DayClose {
  const rows = new Map<string, { attended: number; totalCop: number }>();
  let totalCop = 0;
  let servicesAttended = 0;
  let noShows = 0;
  let pending = 0;

  for (const appointment of input.appointments) {
    if (appointment.status === "no_show") noShows += 1;
    if (appointment.status === "confirmed") pending += 1;
    if (appointment.status !== "attended") continue;
    const row = rows.get(appointment.barberId) ?? { attended: 0, totalCop: 0 };
    for (const line of appointment.lines) {
      row.attended += 1;
      row.totalCop += line.priceCop;
      servicesAttended += 1;
      totalCop += line.priceCop;
    }
    rows.set(appointment.barberId, row);
  }

  const known = new Map(input.barbers.map((barber) => [barber.id, barber]));
  const byBarber = [...rows.entries()]
    .map(([barberId, row]) => {
      const barber = known.get(barberId);
      return {
        barber,
        row: {
          barberId,
          name: barber?.name ?? "",
          attended: row.attended,
          totalCop: row.totalCop,
          commissionCop:
            barber?.isOwner || input.commissionPercent === 0
              ? null
              : commissionOf(row.totalCop, input.commissionPercent),
        },
      };
    })
    .sort(
      (a, b) =>
        (a.barber?.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.barber?.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.row.name.localeCompare(b.row.name, "es-CO"),
    )
    .map(({ row }) => row);

  return { totalCop, servicesAttended, noShows, pending, byBarber };
}

// "Comisión de los barberos": 0 % to 100 %, in steps of 5.
export const COMMISSION_OPTIONS = Array.from(
  { length: 21 },
  (_, index) => index * 5,
);

export function parseCommission(value: string): number | null {
  if (!/^\d{1,3}$/.test(value)) return null;
  const percent = Number(value);
  return (COMMISSION_OPTIONS as readonly number[]).includes(percent)
    ? percent
    : null;
}

// ?dia=YYYY-MM-DD: today, or a past day; a future one opens today (C4).
export function parseCloseDay(
  value: string | string[] | undefined,
  today: BogotaDate,
): BogotaDate {
  return typeof value === "string" && isBogotaDate(value) && value <= today
    ? value
    : today;
}

// "Descargar resumen" (decision C3): a CSV that Excel opens in Colombia
// (";" between fields, a byte order mark for the accents), whole pesos.
export function closeCsv(
  close: DayClose,
  words: { heading: readonly [string, string, string, string]; totals: string },
): string {
  const cell = (value: string | number | null) => {
    // A name that starts like a formula (=, +, -, @) never runs in Excel.
    const raw = value === null ? "" : String(value);
    const text =
      typeof value === "string" && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const row = (values: (string | number | null)[]) =>
    values.map(cell).join(";");
  const commission = close.byBarber.reduce(
    (sum, barber) => sum + (barber.commissionCop ?? 0),
    0,
  );
  return (
    "﻿" +
    [
      row([...words.heading]),
      ...close.byBarber.map((barber) =>
        row([
          barber.name,
          barber.attended,
          barber.totalCop,
          barber.commissionCop,
        ]),
      ),
      row([words.totals, close.servicesAttended, close.totalCop, commission]),
      "",
    ].join("\r\n")
  );
}

// ?aviso= when the commission did not save because the barbershop is paused
// (task 5.5); any other value is a plain failure.
export const PAUSED_WARNING = "pausada";
