import type { RegistrationErrorCode } from "@/modulos/barberias/dominio/registration";
import type { AccountError } from "../datos/auth-errors";
import type { CredentialsErrorCode } from "../dominio/credentials";

export type FormErrorCode =
  RegistrationErrorCode | CredentialsErrorCode | AccountError;

// What a form action sends back to its screen. Values are echoed so the form
// keeps what the person typed; passwords never come back.
export type FormState = {
  fieldErrors?: Partial<Record<string, FormErrorCode>>;
  formError?: FormErrorCode;
  values?: Record<string, string>;
  notice?: "check_email" | "recovery_sent";
};

export function readFields<Field extends string>(
  formData: FormData,
  fields: readonly Field[],
): Record<Field, string> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as Record<Field, string>;
}
