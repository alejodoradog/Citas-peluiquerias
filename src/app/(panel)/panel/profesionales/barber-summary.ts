import { formatBogotaDayMonth } from "@/lib/fechas/fechas";
import { barberLinkState } from "@/modulos/barberias/dominio/barber-link";
import { textos } from "@/ui/textos";
import { summarizeHours } from "../configurar/hours-summary";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";

const t = textos.barberos;

type SummarizedBarber = {
  is_owner: boolean;
  uses_barbershop_hours: boolean;
  link_active: boolean;
  link_issued_at: string | null;
  deactivated_at: string | null;
  service_ids: readonly string[];
};

// The line under a barber's name in D-53. Active: "Horario de la barbería ·
// 3 servicios · link activo"; the owner has no link ("sin link (eres tú)"),
// and a link never issued is "link sin enviar" (task 2.3).
// Inactive: "Se fue el 2 de noviembre · link desactivado".
export function summarizeBarber(barber: SummarizedBarber): string {
  const link = {
    owner: t.sinLink,
    unsent: t.linkSinEnviar,
    active: t.linkActivo,
    off: t.linkDesactivado,
  }[
    barberLinkState({
      isOwner: barber.is_owner,
      linkActive: barber.link_active,
      linkIssuedAt: barber.link_issued_at,
    })
  ];
  if (barber.deactivated_at !== null) {
    return [
      t.seFue(formatBogotaDayMonth(new Date(barber.deactivated_at))),
      link,
    ].join(t.separador);
  }
  return [
    barber.uses_barbershop_hours ? t.horarioBarberia : t.horarioPropio,
    t.conteoServicios(barber.service_ids.length),
    link,
  ].join(t.separador);
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
