import { parseWalkInClash, type WalkInClash } from "../dominio/walk-in";

// Why a walk-in was refused (task 7.7, migration add_walk_in_appointments),
// by the hint of its error:
// - walk_in_clash: it does not fit now; the clash says with what and how
//   much is free;
// - slot_taken: someone took the time in the same instant (a path without
//   the lock, or the exclusion constraint);
// - not_professional: the session is not (or no longer) of a professional;
// - not_found: the establishment is not the owner's;
// - read_only: the establishment is paused;
// - barber_not_found / barber_inactive / barber_does_not_offer_service: the
//   professional cannot take it;
// - services_required / services_repeated / service_inactive / too_long:
//   the chosen services;
// - customer_name_invalid: the name;
// - unknown: anything else (the network).

export const WALK_IN_REFUSALS = [
  "walk_in_clash",
  "slot_taken",
  "not_professional",
  "not_found",
  "read_only",
  "barber_not_found",
  "barber_inactive",
  "barber_does_not_offer_service",
  "services_required",
  "services_repeated",
  "service_inactive",
  "too_long",
  "customer_name_invalid",
] as const;

export type WalkInRefusal = (typeof WALK_IN_REFUSALS)[number] | "unknown";

const KNOWN: ReadonlySet<string> = new Set(WALK_IN_REFUSALS);

export type WalkInFailure = { error: WalkInRefusal; clash: WalkInClash | null };

export function toWalkInFailure(error: {
  code?: string;
  hint?: string | null;
  details?: string | null;
}): WalkInFailure {
  const hint = error.hint ?? "";
  if (hint === "walk_in_clash") {
    const clash = parseWalkInClash(error.details);
    // A clash without its detail still is "it does not fit".
    return { error: "walk_in_clash", clash };
  }
  if (KNOWN.has(hint)) return { error: hint as WalkInRefusal, clash: null };
  // The trigger of task 5.5, should the phase change between the checks.
  if (hint === "barbershop_read_only")
    return { error: "read_only", clash: null };
  if (error.code === "23P01") return { error: "slot_taken", clash: null };
  return { error: "unknown", clash: null };
}
