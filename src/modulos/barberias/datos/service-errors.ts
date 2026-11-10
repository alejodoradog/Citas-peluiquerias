import type { ServiceErrorCode } from "../dominio/service";

// Turns a database error from writing a service into the field it belongs to.
// The form checks the same rules first (parseServiceForm), so these only show
// up if the two ever drift apart.

export type ServiceFormField = "name" | "price" | "duration";

// The shape shared by PostgrestError and Postgres driver errors.
type DatabaseError = { code?: string; message?: string };

const CHECK_VIOLATION = "23514";

const CHECKS: ReadonlyArray<{
  constraint: string;
  field: ServiceFormField;
  code: ServiceErrorCode | "invalid";
}> = [
  { constraint: "services_name_check", field: "name", code: "invalid" },
  {
    constraint: "services_price_cop_check",
    field: "price",
    code: "service_price_invalid",
  },
  {
    constraint: "services_duration_minutes_check",
    field: "duration",
    code: "service_duration_invalid",
  },
];

// The field and code of a broken check, or null for any other error.
export function toServiceFieldError(
  error: DatabaseError,
): { field: ServiceFormField; code: ServiceErrorCode | "invalid" } | null {
  if (error.code !== CHECK_VIOLATION) return null;
  const check = CHECKS.find((c) =>
    error.message?.includes(`"${c.constraint}"`),
  );
  return check ? { field: check.field, code: check.code } : null;
}
