import type { TeamBarberErrorCode } from "../dominio/barber";

// Turns a database error from writing a barber into the field it belongs to.
// The form checks the same rules first (parseTeamBarberForm, isOwnImageKey),
// so these only show up if the two ever drift apart.

export type BarberFormField = "displayName" | "email" | "photo";

// The shape shared by PostgrestError and Postgres driver errors.
type DatabaseError = { code?: string; message?: string };

const CHECK_VIOLATION = "23514";

type BarberFieldError = {
  field: BarberFormField;
  code: TeamBarberErrorCode | "photo_invalid" | "invalid";
};

const CHECKS: ReadonlyArray<{ constraint: string } & BarberFieldError> = [
  {
    constraint: "barbers_display_name_check",
    field: "displayName",
    code: "invalid",
  },
  { constraint: "barbers_email_check", field: "email", code: "email_invalid" },
  {
    constraint: "barbers_notifications_need_email",
    field: "email",
    code: "notifications_need_email",
  },
  {
    constraint: "barbers_photo_in_own_folder",
    field: "photo",
    code: "photo_invalid",
  },
];

// The field and code of a broken check, or null for any other error.
export function toBarberFieldError(
  error: DatabaseError,
): BarberFieldError | null {
  if (error.code !== CHECK_VIOLATION) return null;
  const check = CHECKS.find((c) =>
    error.message?.includes(`"${c.constraint}"`),
  );
  return check ? { field: check.field, code: check.code } : null;
}
