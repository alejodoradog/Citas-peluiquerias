import { formatCalendarDay, formatWallClock } from "@/lib/fechas/fechas";

// The lines that name a day and a time. Apart from summary.ts so the screens
// that choose them in the browser (C-04, C-10) do not carry the booking
// rules along.

export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

// "Martes 24 de noviembre · 10:30 a. m."
export function whenLine(date: string, time: string): string {
  return `${capitalize(formatCalendarDay(date))} · ${formatWallClock(time)}`;
}
