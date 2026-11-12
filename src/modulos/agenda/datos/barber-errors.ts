// Why a function of the barber's link refused (migration add_barber_agenda),
// by the hint of its error, as the screens of "Mi agenda" react to it:
// - link_invalid: the link was deactivated or replaced: B-05;
// - read_only: the barbershop is paused (B-06);
// - not_yours: not an appointment or block of this barber, or the block
//   already ended;
// - not_confirmed: the appointment was already marked or cancelled;
// - too_early: the appointment has not started, or the block starts in the
//   past;
// - barber_inactive: the owner deactivated the barber, who no longer blocks;
// - overlaps_appointment / overlaps_block: the block crosses an appointment
//   or another block;
// - range_invalid: the day or times do not make a block;
// - unknown: anything else (the network).

export type BarberRefusal =
  | "link_invalid"
  | "read_only"
  | "not_yours"
  | "not_confirmed"
  | "too_early"
  | "barber_inactive"
  | "overlaps_appointment"
  | "overlaps_block"
  | "range_invalid"
  | "unknown";

const KNOWN: ReadonlySet<string> = new Set<BarberRefusal>([
  "link_invalid",
  "read_only",
  "not_yours",
  "not_confirmed",
  "too_early",
  "barber_inactive",
  "overlaps_appointment",
  "overlaps_block",
  "range_invalid",
]);

export function toBarberRefusal(error: {
  code?: string;
  hint?: string | null;
}): BarberRefusal {
  const hint = error.hint ?? "";
  if (KNOWN.has(hint)) return hint as BarberRefusal;
  // status_invalid never comes from the screens: they send attended or
  // no_show only.
  return "unknown";
}
