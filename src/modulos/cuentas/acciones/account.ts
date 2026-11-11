"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/safe-next";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { toAccountError, type AccountError } from "@/lib/supabase/auth-errors";
import { now } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasRecentRecoverySession } from "../datos/access";
import { forgetActiveBarbershop } from "../datos/active-barbershop";
import { recoveryLinkIsFresh } from "../dominio/recovery-session";
import {
  parseNewPassword,
  parseEmailLinkToken,
  parseRecoveryRequest,
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
    const accountError = toAccountError(error);
    // Only reached with the right password. The first link lasts 24 hours, so
    // this is how an owner who was late gets another. Limits may skip the
    // send; the message stays the same.
    if (accountError === "email_not_confirmed") {
      await supabase.auth.resend({ type: "signup", email: form.data.email });
    }
    return { status: "failed", error: accountError, values: form.values };
  }
  // The panel sends a super admin on to /admin.
  redirect(routes.panel);
}

// Signs out this device only; the owner stays signed in on their others.
// Actions that always redirect return nothing (decision 0005).
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  await forgetActiveBarbershop();
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

// Emails link to /auth/confirm, which asks for a tap before spending the
// one-time token: some email scanners open links on their own.
export async function confirmPasswordRecovery(
  formData: FormData,
): Promise<void> {
  const expired = `${routes.recoverPassword}?vencido=1`;
  const form = readEmailLink(formData);
  if (!form.valid) {
    redirect(expired);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: form.data.tokenHash,
  });
  if (error) {
    redirect(expired);
  }
  // Auth keeps every email link 24 hours; a recovery link only counts within
  // the hour, so a forwarded or forgotten email cannot take over the account.
  if (!recoveryLinkIsFresh(data.user?.recovery_sent_at, now().getTime())) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(expired);
  }
  redirect(safeNextPath(form.data.next));
}

// Confirming does not sign the owner in. Auth records this session and a
// recovery session the same way, so keeping it would let it set a new password
// (recovery-session.ts). The owner signs in with their password instead.
export async function confirmEmailAddress(formData: FormData): Promise<void> {
  const expired = `${routes.signIn}?vencido=1`;
  const form = readEmailLink(formData);
  if (!form.valid) {
    redirect(expired);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "signup",
    token_hash: form.data.tokenHash,
  });
  if (error) {
    redirect(expired);
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect(`${routes.signIn}?confirmado=1`);
}

function readEmailLink(formData: FormData) {
  return readForm(formData, {
    fields: ["tokenHash", "next"],
    parse: parseEmailLinkToken,
  });
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
