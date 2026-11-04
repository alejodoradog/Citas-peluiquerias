import { z } from "zod";
import { normalizeColombianMobile } from "./phone";

// Error codes, not copy: the screen maps each one to src/ui/textos.ts.
export type RegistrationErrorCode =
  | "owner_name_required"
  | "owner_name_too_long"
  | "barbershop_name_required"
  | "barbershop_name_too_long"
  | "phone_invalid"
  | "email_invalid"
  | "password_too_short"
  | "password_too_long";

const registrationSchema = z.object({
  ownerName: z
    .string({ error: "owner_name_required" })
    .trim()
    .min(1, "owner_name_required")
    .max(100, "owner_name_too_long"),
  barbershopName: z
    .string({ error: "barbershop_name_required" })
    .trim()
    .min(1, "barbershop_name_required")
    .max(100, "barbershop_name_too_long"),
  phone: z.string({ error: "phone_invalid" }).transform((value, ctx) => {
    const phone = normalizeColombianMobile(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .string({ error: "email_invalid" })
    .trim()
    .toLowerCase()
    .pipe(z.email("email_invalid")),
  // Supabase Auth hashes with bcrypt, which reads at most 72 bytes. Accented
  // letters take two bytes, so the limit is checked in bytes, not characters.
  password: z
    .string({ error: "password_too_short" })
    .min(8, "password_too_short")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "password_too_long",
    ),
});

export type Registration = z.output<typeof registrationSchema>;
type Field = keyof Registration;

export type RegistrationResult =
  | { success: true; data: Registration }
  | {
      success: false;
      errors: Partial<Record<Field, RegistrationErrorCode>>;
    };

export function parseRegistration(input: unknown): RegistrationResult {
  const result = registrationSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Partial<Record<Field, RegistrationErrorCode>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field;
    errors[field] ??= issue.message as RegistrationErrorCode;
  }
  return { success: false, errors };
}
