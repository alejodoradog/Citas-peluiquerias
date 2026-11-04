import { z } from "zod";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";
import { emailSchema, passwordSchema } from "./password";

export type CredentialsErrorCode =
  | "email_invalid"
  | "password_required"
  | "password_too_short"
  | "password_too_long"
  | "password_mismatch";

const loginSchema = z.object({
  email: emailSchema,
  // Typed as is: the account decides whether the password is right.
  password: z
    .string({ error: "password_required" })
    .min(1, "password_required"),
});

const recoverySchema = z.object({ email: emailSchema });

const recoveryTokenSchema = z.object({
  tokenHash: z.string().min(1).max(256),
  next: z.string().max(200),
});

const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string({ error: "password_mismatch" }),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "password_mismatch",
    path: ["confirmation"],
  })
  .transform(({ password }) => ({ password }));

export type Login = z.output<typeof loginSchema>;

export function parseLogin(
  input: unknown,
): ParseResult<Login, CredentialsErrorCode> {
  return parseWith(loginSchema, input);
}

export function parseRecoveryRequest(
  input: unknown,
): ParseResult<z.output<typeof recoverySchema>, CredentialsErrorCode> {
  return parseWith(recoverySchema, input);
}

export function parseRecoveryToken(
  input: unknown,
): ParseResult<z.output<typeof recoveryTokenSchema>, CredentialsErrorCode> {
  return parseWith(recoveryTokenSchema, input);
}

export function parseNewPassword(
  input: unknown,
): ParseResult<z.output<typeof newPasswordSchema>, CredentialsErrorCode> {
  return parseWith(newPasswordSchema, input);
}
