import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import { FIRST_AVAILABLE } from "@/modulos/agenda/dominio/booking-flow";
import { textos } from "@/ui/textos";

export { capitalize, whenLine } from "./when";

const t = textos.reservas;

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
