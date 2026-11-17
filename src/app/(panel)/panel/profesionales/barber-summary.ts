import { formatBogotaDayMonth } from "@/lib/fechas/fechas";
import type { AccessView } from "@/modulos/cuentas/dominio/professional-access";
import { textos } from "@/ui/textos";
import { summarizeHours } from "../configurar/hours-summary";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";

const t = textos.barberos;

type SummarizedBarber = {
  uses_barbershop_hours: boolean;
  deactivated_at: string | null;
  service_ids: readonly string[];
};

// The line under a barber's name in D-53. Active: "Horario del
// establecimiento · 3 servicios · con acceso"; inactive: "Se fue el 2 de
// noviembre · sin acceso". The last part is the access to their agenda
// (task 7.6c, decision 0010; it was the private link before): `access` is
// what accessView says, and null for the owner who attends, who has their
// own account and nothing to say there.
export function summarizeBarber(
  barber: SummarizedBarber,
  access: AccessView["kind"] | null,
): string {
  const parts =
    barber.deactivated_at !== null
      ? [t.seFue(formatBogotaDayMonth(new Date(barber.deactivated_at)))]
      : [
          barber.uses_barbershop_hours ? t.horarioBarberia : t.horarioPropio,
          t.conteoServicios(barber.service_ids.length),
        ];
  if (access) parts.push(t.accesoLista[access]);
  return parts.join(t.separador);
}

// The Horario row of D-54: the barbershop's hours, or the barber's own week
// ("Lun a vie 9:00 a. m. – 6:00 p. m."), edited in D-55.
export function summarizeBarberHours(
  usesBarbershopHours: boolean,
  shifts: readonly WeeklyShift[],
): string {
  if (usesBarbershopHours) return t.horarioBarberia;
  return summarizeHours(shifts) || t.horarioPropio;
}
