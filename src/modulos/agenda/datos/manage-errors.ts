// Why cancel_appointment_by_token or reschedule_appointment_by_token refused
// (migration add_manage_appointment), by the hint of its error, as the
// screens of "Gestionar mi cita" react to it:
// - link_invalid: the appointment passed, was cancelled or the link is not
//   one: C-16;
// - too_late: inside the policy's hours: C-13;
// - not_accepting: the barbershop takes no bookings now, so it cannot move;
// - slot_gone: the new time is no longer free: choose another (C-10);
// - same_time: the appointment is already at that time;
// - services_changed: the barber no longer does a service of it, so it
//   cannot move (cancelling still works);
// - unknown: anything else (the network).

export type ManageRefusal =
  | "link_invalid"
  | "too_late"
  | "not_accepting"
  | "slot_gone"
  | "same_time"
  | "services_changed"
  | "unknown";

const SLOT_GONE = new Set([
  "slot_taken",
  "blocked",
  "outside_hours",
  "closed",
  "booking_notice",
  "outside_booking_window",
  "slot_invalid",
  "barber_inactive",
  "barber_does_not_offer_service",
]);

export function toManageRefusal(error: {
  code?: string;
  hint?: string | null;
}): ManageRefusal {
  const hint = error.hint ?? "";
  if (hint === "link_invalid") return "link_invalid";
  if (hint === "too_late") return "too_late";
  if (hint === "not_accepting") return "not_accepting";
  if (hint === "same_time") return "same_time";
  if (hint === "services_changed") return "services_changed";
  if (SLOT_GONE.has(hint) || error.code === "23P01") return "slot_gone";
  return "unknown";
}
