import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  toAccessRefusal,
  toAuthInviteRefusal,
  type AccessRefusal,
  type AccountState,
  type AccountStatus,
} from "../dominio/professional-access";

// The accounts of professionals, from the owner's side (task 7.6b, decision
// 0010). Every question goes first to the database with the owner's own
// session, which checks that the professional is theirs (owner_reaches):
// invite_barber, revoke_barber_account, barber_account_status and
// barber_account_to_delete (migrations add_professional_accounts and
// add_professional_account_app).
//
// The service key is used in exactly two places, and only with what the
// database answered to the owner's session, never with anything the browser
// sent: sending the invitation (Auth creates the account, and the database
// joins it) to the email invite_barber returned, and deleting the account
// barber_account_to_delete returned. Nothing here logs an email, an id or
// Auth's messages.

export type DatabaseResult<T> =
  ({ ok: true } & T) | { ok: false; error: AccessRefusal };

const STATES: ReadonlySet<string> = new Set<AccountState>([
  "none",
  "invited",
  "active",
  "revoked",
]);

// The state of the access, or null when the professional is not the
// owner's (or the database could not answer).
export async function readAccountStatus(
  barberId: string,
): Promise<AccountStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("barber_account_status", {
    p_barber_id: barberId,
  });
  const row = data?.[0];
  if (error || !row || !STATES.has(row.state)) return null;
  return {
    state: row.state as AccountState,
    sentAt: row.sent_at ? new Date(row.sent_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

export type InviteStatus =
  "invited" | "email_taken" | "revoked_account_pending";

export async function inviteInDatabase(
  barberId: string,
): Promise<DatabaseResult<{ status: InviteStatus; email: string | null }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_barber", {
    p_barber_id: barberId,
  });
  if (error) return { ok: false, error: toAccessRefusal(error) };
  const row = data?.[0];
  if (
    row?.status === "invited" ||
    row?.status === "email_taken" ||
    row?.status === "revoked_account_pending"
  ) {
    return { ok: true, status: row.status, email: row.email ?? null };
  }
  return { ok: false, error: "unknown" };
}

export async function revokeInDatabase(
  barberId: string,
): Promise<DatabaseResult<object>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_barber_account", {
    p_barber_id: barberId,
  });
  return error ? { ok: false, error: toAccessRefusal(error) } : { ok: true };
}

// The one account the database lets this owner delete for this professional:
// the revoked one, or the orphan Auth made for the invitation. Null when
// there is none, or the database could not answer.
export async function accountToDelete(
  barberId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("barber_account_to_delete", {
    p_barber_id: barberId,
  });
  return error || typeof data !== "string" ? null : data;
}

// Service key. `accountId` is only ever what accountToDelete returned.
export async function deleteAuthAccount(accountId: string): Promise<boolean> {
  const { error } =
    await createSupabaseAdminClient().auth.admin.deleteUser(accountId);
  return !error;
}

// Service key. `email` is only ever what invite_barber returned. The
// metadata carries the establishment's name for the email, under a key no
// trigger reads (register_owner_on_signup reads barbershop_name, and
// record_terms_acceptance reads terms_version: never sent here).
export async function sendAuthInvitation(
  email: string,
  options: { redirectTo: string | undefined; establishment: string },
): Promise<DatabaseResult<object>> {
  const { error } =
    await createSupabaseAdminClient().auth.admin.inviteUserByEmail(email, {
      ...(options.redirectTo ? { redirectTo: options.redirectTo } : {}),
      data: { invited_to: options.establishment },
    });
  return error
    ? { ok: false, error: toAuthInviteRefusal(error) }
    : { ok: true };
}

// The professional of the owner's active barbershop, as RLS lets the owner
// read it, or null: the card and its actions work on that barbershop only.
export async function barberOfShop(
  barbershopId: string,
  barberId: string,
): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("barbers")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .eq("id", barberId)
    .maybeSingle();
  return data;
}
