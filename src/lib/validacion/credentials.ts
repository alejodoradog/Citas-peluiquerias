import { z } from "zod";

// Shared by sign-up (barberias) and sign-in and recovery (cuentas).

export type CredentialCode =
  "email_invalid" | "password_too_short" | "password_too_long";

// Same limit as private.is_email in the database.
export const MAX_EMAIL_LENGTH = 254;

export const emailSchema = z
  .string({ error: "email_invalid" })
  .trim()
  .toLowerCase()
  .pipe(z.email("email_invalid").max(MAX_EMAIL_LENGTH, "email_invalid"));

// Supabase Auth hashes with bcrypt, which reads at most 72 bytes. Accented
// letters take two bytes, so the limit is checked in bytes, not characters.
// The minimum matches minimum_password_length in supabase/config.toml.
export const passwordSchema = z
  .string({ error: "password_too_short" })
  .min(8, "password_too_short")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "password_too_long",
  );
