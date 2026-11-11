import type { Database } from "@/lib/supabase/database.types";
import { SERVICE_DURATION } from "@/modulos/barberias/dominio/service";

export type AppointmentStatus =
  Database["public"]["Enums"]["appointment_status"];

// Spec, "Estados de una cita": the statuses that take the time. The
// exclusion constraint of appointments (20261104170416) uses the same list;
// a test compares both. The cancelled ones free it.
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = [
  "confirmed",
  "attended",
  "no_show",
];

export function takesTheTime(status: AppointmentStatus): boolean {
  return OCCUPYING_STATUSES.includes(status);
}

// What a booking asks of the availability engine (spec, "Disponibilidad"):
// 1 to 5 different services with one barber in one block, lasting the sum of
// their durations, at most 480 minutes. create_appointment enforces the same
// limits in the database (20261109041314_add_appointment_services.sql).

export const MAX_SERVICES_PER_BOOKING = 5;
export const MAX_BOOKING_MINUTES = 480;

export type BookedService = { id: string; durationMinutes: number };

// - services_empty: no service chosen.
// - services_too_many: more than MAX_SERVICES_PER_BOOKING.
// - services_repeated: the same service twice.
// - service_duration_invalid: a duration outside 5..240 in steps of 5.
// - booking_too_long: the sum goes beyond MAX_BOOKING_MINUTES.
export type BookingDurationError =
  | "services_empty"
  | "services_too_many"
  | "services_repeated"
  | "service_duration_invalid"
  | "booking_too_long";

export type BookingDurationResult =
  { ok: true; minutes: number } | { ok: false; error: BookingDurationError };

function isServiceDuration(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= SERVICE_DURATION.min &&
    minutes <= SERVICE_DURATION.max &&
    minutes % SERVICE_DURATION.step === 0
  );
}

// The minutes the engine looks for: the sum of the chosen services.
export function bookingDuration(
  services: readonly BookedService[],
): BookingDurationResult {
  if (services.length === 0) return { ok: false, error: "services_empty" };
  if (services.length > MAX_SERVICES_PER_BOOKING) {
    return { ok: false, error: "services_too_many" };
  }
  if (new Set(services.map((s) => s.id)).size !== services.length) {
    return { ok: false, error: "services_repeated" };
  }
  if (!services.every((s) => isServiceDuration(s.durationMinutes))) {
    return { ok: false, error: "service_duration_invalid" };
  }
  const minutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  if (minutes > MAX_BOOKING_MINUTES) {
    return { ok: false, error: "booking_too_long" };
  }
  return { ok: true, minutes };
}

// The barbers who can take a booking: active, and offering every chosen
// service (spec: "el barbero debe ofrecerlos todos"; decision 0006: "el
// primero disponible" chooses only among these). Keeps the order given.
export function eligibleBarbers<
  Barber extends { active: boolean; serviceIds: readonly string[] },
>(barbers: readonly Barber[], serviceIds: readonly string[]): Barber[] {
  return barbers.filter(
    (barber) =>
      barber.active && serviceIds.every((id) => barber.serviceIds.includes(id)),
  );
}
