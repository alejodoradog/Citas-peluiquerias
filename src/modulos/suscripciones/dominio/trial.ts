import { addDays } from "@/lib/fechas/fechas";

// Spec, Suscripciones: the free trial runs through the signup day in Bogotá
// plus 20 full days. The database applies the same rule when the owner signs
// up (private.register_owner_on_signup); this is the rule for the app.
export const TRIAL_DAYS = 20;

// Both dates are calendar days in Bogotá ("2026-11-04").
export function trialEndsOn(signupDate: string): string {
  return addDays(signupDate, TRIAL_DAYS);
}

// The trial runs through its last day in Bogotá: it has ended from the next
// day on. A sede created after that takes no bookings until its first
// payment (spec, Registro y configuración; create_barbershop).
export function trialHasEnded(trialEndsOn: string, today: string): boolean {
  return today > trialEndsOn;
}
