import { formatCalendarDay, formatWallClock } from "@/lib/fechas/fechas";
import type { HolidayKey } from "@/lib/fechas/festivos";
import {
  END_OF_DAY,
  describeClosure,
} from "@/modulos/barberias/dominio/closures";
import { textos } from "@/ui/textos";

const t = textos.festivos;

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

function time(value: string): string {
  return value === END_OF_DAY ? t.medianoche : formatWallClock(value);
}

// "Lunes 16 de noviembre", as D-59 opens each row.
export function holidayDay(date: string): string {
  return capitalize(formatCalendarDay(date));
}

export function holidayNames(keys: readonly HolidayKey[]): string {
  return keys.map((key) => t.nombres[key]).join(" · ");
}

// The first line of a closure in D-59: "Jueves 24 de diciembre · desde
// 2:00 p. m.", in Bogotá.
export function closureTitle(startsAt: Date, endsAt: Date): string {
  const span = describeClosure(startsAt, endsAt);
  switch (span.kind) {
    case "day":
      return t.cierre.day(holidayDay(span.date));
    case "days":
      return t.cierre.days(
        formatCalendarDay(span.from),
        formatCalendarDay(span.to),
      );
    case "from":
      return t.cierre.from(holidayDay(span.date), time(span.time));
    case "until":
      return t.cierre.until(holidayDay(span.date), time(span.time));
    case "between":
      return t.cierre.between(
        holidayDay(span.date),
        time(span.from),
        time(span.to),
      );
    case "span":
      return t.cierre.span(
        formatCalendarDay(span.from.date),
        time(span.from.time),
        formatCalendarDay(span.to.date),
        time(span.to.time),
      );
  }
}
