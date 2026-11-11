import { z } from "zod";
import { emailSchema } from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { normalizeColombianMobile } from "@/modulos/barberias/dominio/phone";

// C-06: name, email and an optional Colombian mobile, as book_appointment
// checks them again (name of 1 to 100 characters, private.is_email, a mobile
// in E.164). The email is trimmed and in lowercase, so one person is one
// customer of the barbershop.

export const CUSTOMER_NAME_MAX = 100;

export type CustomerDetailsErrorCode =
  | "name_required"
  | "name_too_long"
  | "name_invalid"
  | "email_invalid"
  | "phone_invalid";

export type CustomerDetails = {
  name: string;
  email: string;
  phone: string | null;
};

const schema = z.object({
  name: z
    .string({ error: "name_required" })
    .trim()
    .min(1, "name_required")
    .max(CUSTOMER_NAME_MAX, "name_too_long")
    // No control characters: the name reaches the panel and, from phase 5,
    // emails (security review of 3.2).
    .regex(/^[^\p{Cc}]*$/u, "name_invalid"),
  email: emailSchema,
  phone: z
    .string({ error: "phone_invalid" })
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const mobile = normalizeColombianMobile(value);
      if (!mobile) {
        context.addIssue({ code: "custom", message: "phone_invalid" });
        return z.NEVER;
      }
      return mobile;
    }),
});

export function parseCustomerDetails(
  input: unknown,
): ParseResult<CustomerDetails, CustomerDetailsErrorCode> {
  return parseWith(schema, input);
}
