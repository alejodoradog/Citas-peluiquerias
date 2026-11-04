"use server";

import { redirect } from "next/navigation";
import { hasRecentRecoverySession } from "@/lib/auth/access";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAccountError } from "../datos/auth-errors";
import {
  parseLogin,
  parseNewPassword,
  parseRecoveryRequest,
  parseRecoveryToken,
} from "../dominio/credentials";
import { readFields, type FormState } from "./form-state";

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["email", "password"] as const);
  const values = { email: fields.email };

  const parsed = parseLogin(fields);
  if (!parsed.success) {
    return { fieldErrors: parsed.errors, values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { formError: toAccountError(error), values };
  }
  // The panel sends a super admin on to /admin.
  redirect("/panel");
}

// Signs out this device only; the owner stays signed in on their others.
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/ingresar");
}

// Always answers the same, even when Supabase limits the emails sent, so the
// screen never reveals which emails have an account.
export async function requestRecovery(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, ["email"] as const);

  const parsed = parseRecoveryRequest(fields);
  if (!parsed.success) {
    return { fieldErrors: parsed.errors, values: fields };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  return { notice: "recovery_sent" };
}

// The recovery email links to /auth/confirm, which asks for a tap before
// spending the one-time token: some email scanners open links on their own.
export async function confirmRecovery(formData: FormData): Promise<void> {
  const fields = readFields(formData, ["token_hash", "next"] as const);
  const parsed = parseRecoveryToken({
    tokenHash: fields.token_hash,
    next: fields.next,
  });
  if (!parsed.success) {
    redirect("/recuperar-clave?vencido=1");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: parsed.data.tokenHash,
  });
  if (error) {
    redirect("/recuperar-clave?vencido=1");
  }
  redirect(safeNextPath(parsed.data.next));
}

export async function setNewPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseNewPassword(
    readFields(formData, ["password", "confirmation"] as const),
  );
  if (!parsed.success) {
    return { fieldErrors: parsed.errors };
  }
  // Only the session a recovery link opened may set a new password.
  if (!(await hasRecentRecoverySession())) {
    return { formError: "link_expired" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    const missingSession = error.name === "AuthSessionMissingError";
    return {
      formError: missingSession ? "link_expired" : toAccountError(error),
    };
  }
  redirect("/panel");
}
