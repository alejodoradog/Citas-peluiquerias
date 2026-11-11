import { formatCalendarDay, formatWallClock } from "@/lib/fechas/fechas";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import { FIRST_AVAILABLE } from "@/modulos/agenda/dominio/booking-flow";
import { textos } from "@/ui/textos";

const t = textos.reservas;

export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

// "Corte + Barba · 60 min", plus the barber when there is one (C-03 to C-06).
export function servicesLine(
  availability: Pick<PublicAvailability, "services" | "durationMinutes">,
): string {
  return `${availability.services.map((s) => s.name).join(" + ")} · ${t.minutos(availability.durationMinutes)}`;
}

export function barberName(
  profile: PublicProfile,
  barber: string | null,
): string | null {
  if (barber === FIRST_AVAILABLE) return t.barbero.primero;
  return profile.barbers.find((b) => b.id === barber)?.name ?? null;
}

// "Martes 24 de noviembre · 10:30 a. m."
export function whenLine(date: string, time: string): string {
  return `${capitalize(formatCalendarDay(date))} · ${formatWallClock(time)}`;
}
