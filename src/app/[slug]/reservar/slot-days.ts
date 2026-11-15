import { toBogotaTime, type BogotaDate } from "@/lib/fechas/fechas";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import { dayPart, type DayPart } from "@/modulos/agenda/dominio/booking-flow";

// What the time screens (C-04, C-10) send to the browser: for each day of the
// booking window, its free start times on the Bogotá wall clock, already
// grouped as "Mañana", "Tarde" and "Noche". The server computes them once
// with the availability engine; the browser only chooses among them, so a
// day or an hour answers the tap without asking the server again. Only free
// times travel, never who took the others; the database checks the chosen
// one again when the booking or the move is confirmed.

export type DayTimes = {
  date: BogotaDate;
  times: Record<DayPart, string[]>;
};

export function toDayTimes(days: readonly DayAvailability[]): DayTimes[] {
  return days.map((day) => {
    const times: Record<DayPart, string[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const slot of day.slots) {
      const time = toBogotaTime(slot.start);
      times[dayPart(time)].push(time);
    }
    return { date: day.date, times };
  });
}
