// Why a function of the owner's panel refused (migration
// add_owner_appointment_actions, task 4.2), by the hint of its error:
// - not_found: the appointment, block or barbershop is not the owner's, or
//   no longer exists;
// - barber_not_found / customer_not_found: the same for the barber or the
//   chosen customer;
// - customer_name_invalid / customer_email_invalid / customer_phone_invalid:
//   the new customer's details;
// - services_required / services_repeated / service_inactive / too_long:
//   the chosen services;
// - barber_inactive / barber_does_not_offer_service: the barber cannot take
//   them;
// - slot_invalid / too_early / outside_booking_window / closed /
//   outside_hours / blocked / slot_taken: the time does not work (taken in
//   the meantime, most often);
// - not_confirmed / not_started / status_invalid / appointment_closed: the
//   appointment changed state in the meantime, or has not started;
// - overlaps_appointment / overlaps_block / range_invalid / block_ended: a
//   block that does not fit;
// - unknown: anything else (the network).

export const OWNER_REFUSALS = [
  "not_found",
  "barber_not_found",
  "customer_not_found",
  "customer_name_invalid",
  "customer_email_invalid",
  "customer_phone_invalid",
  "services_required",
  "services_repeated",
  "service_inactive",
  "too_long",
  "barber_inactive",
  "barber_does_not_offer_service",
  "slot_invalid",
  "too_early",
  "outside_booking_window",
  "closed",
  "outside_hours",
  "blocked",
  "slot_taken",
  "not_confirmed",
  "not_started",
  "status_invalid",
  "appointment_closed",
  "overlaps_appointment",
  "overlaps_block",
  "range_invalid",
  "block_ended",
] as const;

export type OwnerRefusal = (typeof OWNER_REFUSALS)[number] | "unknown";

const KNOWN: ReadonlySet<string> = new Set(OWNER_REFUSALS);

export function toOwnerRefusal(error: {
  code?: string;
  hint?: string | null;
}): OwnerRefusal {
  const hint = error.hint ?? "";
  if (KNOWN.has(hint)) return hint as OwnerRefusal;
  // The exclusion constraint, should a race get past the checks.
  if (error.code === "23P01") return "slot_taken";
  return "unknown";
}
