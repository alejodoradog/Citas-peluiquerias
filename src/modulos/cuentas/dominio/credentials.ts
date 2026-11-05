import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  type CredentialCode,
} from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

export type CredentialsErrorCode =
  CredentialCode | "password_required" | "password_mismatch";

const signInSchema = z.object({
  email: emailSchema,
  // Typed as is: the account decides whether the password is right.
  password: z
    .string({ error: "password_required" })
    .min(1, "password_required"),
});

const recoveryRequestSchema = z.object({ email: emailSchema });

const emailLinkTokenSchema = z.object({
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

export function parseSignIn(
  input: unknown,
): ParseResult<z.output<typeof signInSchema>, CredentialsErrorCode> {
  return parseWith(signInSchema, input);
}

export function parseRecoveryRequest(
  input: unknown,
): ParseResult<z.output<typeof recoveryRequestSchema>, CredentialsErrorCode> {
  return parseWith(recoveryRequestSchema, input);
}

export function parseEmailLinkToken(
  input: unknown,
): ParseResult<z.output<typeof emailLinkTokenSchema>, CredentialsErrorCode> {
  return parseWith(emailLinkTokenSchema, input);
}

export function parseNewPassword(
  input: unknown,
): ParseResult<z.output<typeof newPasswordSchema>, CredentialsErrorCode> {
  return parseWith(newPasswordSchema, input);
}
