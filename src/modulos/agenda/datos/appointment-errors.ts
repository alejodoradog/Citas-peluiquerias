// Turns database errors from writing an appointment into errors the app
// understands. See docs/decisiones/0003-citas-sin-cruces.md.

export type AppointmentWriteError = "slot_taken" | "unknown";

// The shape shared by PostgrestError and Postgres driver errors.
type DatabaseError = { code?: string; message?: string };

const EXCLUSION_VIOLATION = "23P01";
const NO_OVERLAP_CONSTRAINT = "appointments_no_overlap";

export function toAppointmentWriteError(
  error: DatabaseError,
): AppointmentWriteError {
  if (
    error.code === EXCLUSION_VIOLATION &&
    error.message?.includes(NO_OVERLAP_CONSTRAINT)
  ) {
    return "slot_taken";
  }
  return "unknown";
}
