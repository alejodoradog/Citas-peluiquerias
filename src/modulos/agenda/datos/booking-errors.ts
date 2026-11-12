// Why book_appointment refused a booking (migration add_public_booking), by
// the hint of its error, as the screens of the flow react to it:
// - slot_gone: the time is no longer free (taken, blocked, out of hours or
//   of the window, inside the notice, the barber left): C-07, choose again;
// - not_accepting: the barbershop takes no bookings now: C-17;
// - services_changed: a service is no longer offered: choose again;
// - customer_invalid: the details the database refused (the form checks
//   the same first);
// - too_many_upcoming: that email already has 5 upcoming appointments here;
// - too_many_from_ip: 10 bookings in the last hour from that IP (task 3.5);
// - unknown: anything else (the network, a token hash already used).

export type BookingRefusal =
  | "slot_gone"
  | "not_accepting"
  | "services_changed"
  | "customer_invalid"
  | "too_many_upcoming"
  | "too_many_from_ip"
  | "unknown";

const SLOT_GONE = new Set([
  "slot_taken",
  "blocked",
  "outside_hours",
  "closed",
  "booking_notice",
  "outside_booking_window",
  "slot_invalid",
  "barber_unavailable",
  "barber_inactive",
  "barber_does_not_offer_service",
]);
const SERVICES_CHANGED = new Set([
  "service_inactive",
  "services_required",
  "services_repeated",
  "booking_too_long",
]);
const CUSTOMER_INVALID = new Set([
  "customer_name_invalid",
  "customer_email_invalid",
  "customer_phone_invalid",
]);

export function toBookingRefusal(error: {
  code?: string;
  hint?: string | null;
}): BookingRefusal {
  const hint = error.hint ?? "";
  // The exclusion constraint itself, should it ever reach the caller.
  if (SLOT_GONE.has(hint) || error.code === "23P01") return "slot_gone";
  if (hint === "not_accepting") return "not_accepting";
  if (hint === "too_many_upcoming") return "too_many_upcoming";
  if (hint === "too_many_from_ip") return "too_many_from_ip";
  if (SERVICES_CHANGED.has(hint)) return "services_changed";
  if (CUSTOMER_INVALID.has(hint)) return "customer_invalid";
  return "unknown";
}
