"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/safe-next";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { toAccountError, type AccountError } from "@/lib/supabase/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasRecentRecoverySession } from "../datos/access";
import {
  parseNewPassword,
  parseRecoveryRequest,
  parseRecoveryToken,
  parseSignIn,
  type CredentialsErrorCode,
} from "../dominio/credentials";

export type AccountErrorCode = CredentialsErrorCode | AccountError;

export type SignInState = FormState<"email" | "password", AccountErrorCode>;
export type RecoveryRequestState = FormState<
  "email",
  AccountErrorCode,
  "recovery_sent"
>;
export type NewPasswordState = FormState<
  "password" | "confirmation",
  AccountErrorCode
>;

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const form = readForm(formData, {
    fields: ["email", "password"],
    secret: ["password"],
    parse: parseSignIn,
  });
  if (!form.valid) {
    return form.state;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(form.data);
  if (error) {
    return {
      status: "failed",
      error: toAccountError(error),
      values: form.values,
    };
  }
  // The panel sends a super admin on to /admin.
  redirect(routes.panel);
}

// Signs out this device only; the owner stays signed in on their others.
// Actions that always redirect return nothing (decision 0005).
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(routes.signIn);
}

// Always answers the same, even when Supabase limits the emails sent, so the
// screen never reveals which emails have an account.
export async function requestPasswordRecovery(
  _previous: RecoveryRequestState,
  formData: FormData,
): Promise<RecoveryRequestState> {
  const form = readForm(formData, {
    fields: ["email"],
    parse: parseRecoveryRequest,
  });
  if (!form.valid) {
    return form.state;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(form.data.email);
  return { status: "done", notice: "recovery_sent" };
}

// The recovery email links to /auth/confirm, which asks for a tap before
// spending the one-time token: some email scanners open links on their own.
export async function confirmPasswordRecovery(
  formData: FormData,
): Promise<void> {
  const form = readForm(formData, {
    fields: ["tokenHash", "next"],
    parse: parseRecoveryToken,
  });
  const expired = `${routes.recoverPassword}?vencido=1`;
  if (!form.valid) {
    redirect(expired);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: form.data.tokenHash,
  });
  if (error) {
    redirect(expired);
  }
  redirect(safeNextPath(form.data.next));
}

export async function setNewPassword(
  _previous: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const form = readForm(formData, {
    fields: ["password", "confirmation"],
    secret: ["password", "confirmation"],
    parse: parseNewPassword,
  });
  if (!form.valid) {
    return form.state;
  }
  // Only the session a recovery link opened may set a new password.
  if (!(await hasRecentRecoverySession())) {
    return { status: "failed", error: "link_expired", values: {} };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: form.data.password,
  });
  if (error) {
    const missingSession = error.name === "AuthSessionMissingError";
    return {
      status: "failed",
      error: missingSession ? "link_expired" : toAccountError(error),
      values: {},
    };
  }
  redirect(routes.panel);
}
