import { formatWallClock } from "@/lib/fechas/fechas";
import { groupWeek, type WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { textos } from "@/ui/textos";

const t = textos.asistente.horario;

// "Lun a vie 9:00 a. m. – 8:00 p. m. · Sáb 8:00 a. m. – 9:00 p. m." (D-13).
export function summarizeHours(hours: readonly WeeklyShift[]): string {
  return groupWeek(hours)
    .map((group) => {
      const days =
        group.fromDay === group.toDay
          ? t.dias[group.fromDay]!
          : t.rango(t.dias[group.fromDay]!, t.dias[group.toDay]!);
      const shifts = group.shifts
        .map((s) => `${formatWallClock(s.start)} – ${formatWallClock(s.end)}`)
        .join(", ");
      return `${days} ${shifts}`;
    })
    .join(" · ");
}
