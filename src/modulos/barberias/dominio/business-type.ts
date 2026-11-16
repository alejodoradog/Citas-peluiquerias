// The kind of business an establishment is (task 7.2). The owner chooses it
// at sign-up; the platform panel counts establishments by it. The database
// keeps the same list (the enum public.business_type), and
// business-type.test.ts fails if they drift apart.
export const BUSINESS_TYPES = [
  "barbershop",
  "beauty_salon",
  "veterinary",
  "psychology",
  "dentistry",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

// What the owner writes when they choose "other", as
// barbershops.business_type_other accepts it.
export const BUSINESS_TYPE_OTHER_MAX = 60;

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" &&
    (BUSINESS_TYPES as readonly string[]).includes(value)
  );
}
