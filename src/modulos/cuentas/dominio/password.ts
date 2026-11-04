import { z } from "zod";

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

export const emailSchema = z
  .string({ error: "email_invalid" })
  .trim()
  .toLowerCase()
  .pipe(z.email("email_invalid"));
