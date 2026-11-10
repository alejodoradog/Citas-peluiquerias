// Weekly hours of a barbershop: weekday 0 is Sunday and 6 is Saturday, as in
// src/lib/fechas; times are "HH:MM" in Bogotá. Split shifts are allowed.
export type WeeklyShift = { weekday: number; start: string; end: string };

// The hours a barbershop gets when the setup wizard finishes and it has none:
// the ones the design shows (D-13, D-58). Provisional until the founder
// confirms them (docs/tareas/2.1-asistente-de-configuracion.md, decision 1);
// the owner changes them in task 2.4.
export const DEFAULT_BARBERSHOP_HOURS: readonly WeeklyShift[] = [
  { weekday: 1, start: "09:00", end: "20:00" },
  { weekday: 2, start: "09:00", end: "20:00" },
  { weekday: 3, start: "09:00", end: "20:00" },
  { weekday: 4, start: "09:00", end: "20:00" },
  { weekday: 5, start: "09:00", end: "20:00" },
  { weekday: 6, start: "08:00", end: "21:00" },
];

// Days in the order people read a week: Monday first, Sunday last.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type WeekGroup = {
  fromDay: number;
  toDay: number;
  shifts: Array<{ start: string; end: string }>;
};

// Groups consecutive days with the same shifts, so a summary reads
// "Lun a vie 9:00 a. m. – 8:00 p. m. · Sáb 8:00 a. m. – 9:00 p. m.". Closed
// days are left out. The copy is built by the screen from src/ui/textos.ts.
export function groupWeek(hours: readonly WeeklyShift[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  let last: { group: WeekGroup; key: string; index: number } | null = null;

  WEEK_ORDER.forEach((weekday, index) => {
    const shifts = hours
      .filter((shift) => shift.weekday === weekday)
      .map(({ start, end }) => ({
        start: start.slice(0, 5),
        end: end.slice(0, 5),
      }))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (shifts.length === 0) {
      last = null;
      return;
    }
    const key = shifts.map((s) => `${s.start}-${s.end}`).join(",");
    if (last && last.key === key && last.index === index - 1) {
      last.group.toDay = weekday;
      last.index = index;
      return;
    }
    const group = { fromDay: weekday, toDay: weekday, shifts };
    groups.push(group);
    last = { group, key, index };
  });

  return groups;
}
