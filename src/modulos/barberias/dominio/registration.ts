import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  type CredentialCode,
} from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { normalizeColombianMobile } from "./phone";

// Error codes, not copy: the screen maps each one to src/ui/textos.ts.
export type BarbershopErrorCode =
  | "owner_name_required"
  | "owner_name_too_long"
  | "barbershop_name_required"
  | "barbershop_name_too_long"
  | "phone_invalid";

export type RegistrationErrorCode = BarbershopErrorCode | CredentialCode;

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
  email: emailSchema,
  password: passwordSchema,
});

export type Registration = z.output<typeof registrationSchema>;

export type RegistrationResult = ParseResult<
  Registration,
  RegistrationErrorCode
>;

export function parseRegistration(input: unknown): RegistrationResult {
  return parseWith(registrationSchema, input);
}
