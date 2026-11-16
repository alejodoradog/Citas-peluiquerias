import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  type CredentialCode,
} from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { BUSINESS_TYPE_OTHER_MAX, BUSINESS_TYPES } from "./business-type";
import { normalizeColombianMobile } from "./phone";

// Error codes, not copy: the screen maps each one to src/ui/textos.ts.
export type BarbershopErrorCode =
  | "owner_name_required"
  | "owner_name_too_long"
  | "barbershop_name_required"
  | "barbershop_name_too_long"
  | "phone_invalid"
  | "business_type_required"
  | "business_type_other_required"
  | "business_type_other_too_long"
  | "terms_required";

export type RegistrationErrorCode = BarbershopErrorCode | CredentialCode;

// The barbershop's name, as barbershops.name accepts it (1 to 100). Also
// the rule of D-57, where the owner changes it.
export const barbershopNameSchema = z
  .string({ error: "barbershop_name_required" })
  .trim()
  .min(1, "barbershop_name_required")
  .max(100, "barbershop_name_too_long");

// A Colombian mobile, stored in E.164.
export const colombianMobileSchema = z
  .string({ error: "phone_invalid" })
  .transform((value, ctx) => {
    const phone = normalizeColombianMobile(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return phone;
  });

const registrationSchema = z
  .object({
    ownerName: z
      .string({ error: "owner_name_required" })
      .trim()
      .min(1, "owner_name_required")
      .max(100, "owner_name_too_long"),
    barbershopName: barbershopNameSchema,
    // The kind of business (task 7.2), and which one when it is "other".
    businessType: z.enum(BUSINESS_TYPES, { error: "business_type_required" }),
    businessTypeOther: z.string().trim().optional(),
    phone: colombianMobileSchema,
    email: emailSchema,
    password: passwordSchema,
    // The express authorization of Ley 1581 (task 6.5): the box, marked.
    acepto: z.literal("on", { error: "terms_required" }),
  })
  .superRefine(({ businessType, businessTypeOther }, ctx) => {
    if (businessType !== "other") return;
    const other = businessTypeOther ?? "";
    if (other === "") {
      ctx.addIssue({
        code: "custom",
        path: ["businessTypeOther"],
        message: "business_type_other_required",
      });
    } else if (other.length > BUSINESS_TYPE_OTHER_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["businessTypeOther"],
        message: "business_type_other_too_long",
      });
    }
  })
  // The box is proof enough once checked; the data carries the rest. What
  // was written for "other" only counts when "other" is the kind chosen.
  .transform(({ acepto: _accepted, businessTypeOther, ...registration }) => ({
    ...registration,
    businessTypeOther:
      registration.businessType === "other"
        ? (businessTypeOther ?? null)
        : null,
  }));

export type Registration = z.output<typeof registrationSchema>;

export type RegistrationResult = ParseResult<
  Registration,
  RegistrationErrorCode
>;

export function parseRegistration(input: unknown): RegistrationResult {
  return parseWith(registrationSchema, input);
}
