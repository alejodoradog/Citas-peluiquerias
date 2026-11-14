import {
  formatBogotaDayMonthYear,
  fromBogota,
  getWeekday,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { PlatformState } from "@/modulos/suscripciones/dominio/subscription";
import type { ChipTone } from "@/ui/chip";
import { textos } from "@/ui/textos";

// The words of the platform panel's dates (P-01 to P-06), from textos, as
// the design writes them.
const a = textos.agenda;

function parts(date: BogotaDate) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)) - 1,
    day: Number(date.slice(8, 10)),
  };
}

// "24 nov 2026" (P-01, P-02).
export function shortDate(date: BogotaDate): string {
  const { year, month, day } = parts(date);
  return `${day} ${a.mesesCortos[month]} ${year}`;
}

// "8 sep" (P-02, "Registro").
export function dayMonth(date: BogotaDate): string {
  const { month, day } = parts(date);
  return `${day} ${a.mesesCortos[month]}`;
}

// "oct": the short name of a date's month (P-02, "Citas en oct").
export function shortMonth(date: BogotaDate): string {
  return a.mesesCortos[parts(date).month]!;
}

// "noviembre de 2026" with a capital (P-06).
export function monthYear(date: BogotaDate): string {
  const { year, month } = parts(date);
  const name = a.meses[month]!;
  return `${name.charAt(0).toLocaleUpperCase("es-CO")}${name.slice(1)} ${year}`;
}

// "9 de diciembre de 2026" (P-03, P-04).
export function longDate(date: BogotaDate): string {
  return formatBogotaDayMonthYear(fromBogota(date, "12:00"));
}

// "Sábado 7 de noviembre de 2026" (P-03, the payment day).
export function weekdayLongDate(date: BogotaDate): string {
  const weekday = a.dias[getWeekday(date)]!;
  return `${weekday.charAt(0).toLocaleUpperCase("es-CO")}${weekday.slice(1)} ${longDate(date)}`;
}

// Days from one date to another (negative when the second is earlier).
export function daysBetween(from: BogotaDate, to: BogotaDate): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

// The chip of each state, with the tones of F-01.
export const STATE_TONES = {
  trial: "brand",
  active: "success",
  expiring: "warning",
  grace: "danger",
  expired: "danger",
  suspended: "neutral",
  awaiting: "neutral",
} as const satisfies Record<PlatformState, ChipTone>;
