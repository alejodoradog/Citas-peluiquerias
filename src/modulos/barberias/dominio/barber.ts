import { z } from "zod";
import { emailSchema } from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

export const BARBER_NAME_MAX = 60;

export type BarberErrorCode =
  | "barber_name_required"
  | "barber_name_too_long"
  | "barber_services_required"
  | "email_invalid";

const barberFormSchema = z.object({
  displayName: z
    .string({ error: "barber_name_required" })
    .trim()
    .min(1, "barber_name_required")
    .max(BARBER_NAME_MAX, "barber_name_too_long"),
  // Optional: an empty field means no email.
  email: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(emailSchema.nullable()),
  serviceKeys: z.array(z.string()).min(1, "barber_services_required"),
});

export type BarberForm = z.output<typeof barberFormSchema>;

export function parseBarberForm(
  input: unknown,
): ParseResult<BarberForm, BarberErrorCode> {
  return parseWith(barberFormSchema, input);
}
