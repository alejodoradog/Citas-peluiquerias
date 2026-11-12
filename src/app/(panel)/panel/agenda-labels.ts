import {
  formatShortWallClock,
  formatWallClock,
  getWeekday,
  toBogotaTime,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { textos } from "@/ui/textos";

const t = textos.agenda;

// The words of the agenda's dates (D-30 to D-32), from textos: the month is
// short in a day ("sábado 7 de nov") and long in a week ("2 – 8 de
// noviembre"), as the design writes them.

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

// "Hoy, sábado 7 de nov" or "Domingo 8 de nov".
export function dayTitle(date: BogotaDate, today: BogotaDate): string {
  const { day, month, weekday } = parts(date);
  const text = t.fecha(t.dias[weekday]!, day, t.mesesCortos[month]!);
  return date === today ? t.hoy(text) : capitalize(text);
}

// "2 – 8 de noviembre" or "30 de noviembre – 6 de diciembre".
export function weekTitle(days: readonly BogotaDate[]): string {
  const first = parts(days[0]!);
  const last = parts(days.at(-1)!);
  const from =
    first.month === last.month
      ? String(first.day)
      : `${first.day} de ${t.meses[first.month]}`;
  return t.semana(from, `${last.day} de ${t.meses[last.month]}`);
}

// "Lun 2", or "Sáb 7 · hoy".
export function weekDayLabel(date: BogotaDate, today: BogotaDate): string {
  const { day, weekday } = parts(date);
  const label = t.diaSemana(t.diasCortos[weekday]!, day);
  return date === today ? t.diaHoy(label) : label;
}

// "9:20 a. m.", in Bogotá.
export function timeLabel(instant: Date): string {
  return formatWallClock(toBogotaTime(instant));
}

// "9:00", "1:00": the hours down the side of the grid of D-30.
export function hourLabel(instant: Date): string {
  return formatShortWallClock(toBogotaTime(instant));
}
