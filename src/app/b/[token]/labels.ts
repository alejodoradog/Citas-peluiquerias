import {
  formatWallClock,
  getWeekday,
  toBogotaTime,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import type { BarberBlock } from "@/modulos/agenda/dominio/barber-agenda";
import { textos } from "@/ui/textos";

// The words of the barber's dates and times (B-01 to B-04), from textos, as
// the owner's agenda writes them (task 4.1).
const a = textos.agenda;

function parts(date: BogotaDate) {
  return {
    day: Number(date.slice(8, 10)),
    month: Number(date.slice(5, 7)) - 1,
    weekday: getWeekday(date),
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

// "9:20 a. m.", in Bogotá.
export function timeLabel(instant: Date): string {
  return formatWallClock(toBogotaTime(instant));
}

// "10:40 – 11:40 a. m." (B-03): the first "a. m." goes when both share it.
export function timeRangeLabel(start: Date, end: Date): string {
  const from = timeLabel(start);
  const to = timeLabel(end);
  const suffix = / [ap]\. m\.$/;
  const same = from.match(suffix)?.[0] === to.match(suffix)?.[0];
  return a.semana(same ? from.replace(suffix, "") : from, to);
}

// "Hoy, sábado 7 de nov" (B-03), or with the long month, "Hoy, sábado 7 de
// noviembre" (the days of B-04).
export function dayLabel(
  date: BogotaDate,
  today: BogotaDate,
  month: "short" | "long" = "short",
): string {
  const { day, month: index, weekday } = parts(date);
  const months = month === "short" ? a.mesesCortos : a.meses;
  const text = a.fecha(a.dias[weekday]!, day, months[index]!);
  return date === today ? a.hoy(text) : capitalize(text);
}

// "Lun 9" (B-02).
export function weekDayLabel(date: BogotaDate): string {
  const { day, weekday } = parts(date);
  return a.diaSemana(a.diasCortos[weekday]!, day);
}

// "9 – 15 de noviembre" or "30 de noviembre – 6 de diciembre" (B-02).
export function weekTitle(days: readonly BogotaDate[]): string {
  const first = parts(days[0]!);
  const last = parts(days.at(-1)!);
  const from =
    first.month === last.month
      ? String(first.day)
      : `${first.day} de ${a.meses[first.month]}`;
  return a.semana(from, `${last.day} de ${a.meses[last.month]}`);
}

// "Almuerzo" or the default words of a block without a reason.
export function blockLabel(block: BarberBlock): string {
  return block.reason ?? (block.own ? a.bloqueo : a.cierre);
}

// "Corte + Barba".
export function servicesLabel(names: readonly string[]): string {
  return names.join(" + ");
}
