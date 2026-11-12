import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { hashLinkToken, isLinkToken } from "@/lib/tokens/link-token";
import { toManageRefusal, type ManageRefusal } from "./manage-errors";

// "Gestionar mi cita" (task 3.4), always as anon: the link's token is the
// whole credential, and only its hash goes to the database
// (migration add_manage_appointment).

export type ManagedAppointment = {
  barbershopId: string;
  slug: string;
  start: Date;
  end: Date;
  priceCop: number;
  barberId: string;
  barberName: string;
  serviceNames: string[];
  customerFirstName: string;
  cancellationNoticeHours: number;
  // Still before the policy's hours: it can be cancelled or moved here.
  changeable: boolean;
};

// Null for a link that does not work (C-16): the appointment passed, was
// cancelled, or the token is not one. Never cached: it changes with every
// cancellation or move.
export async function loadManagedAppointment(
  token: string,
): Promise<ManagedAppointment | null> {
  if (!isLinkToken(token)) return null;
  const { data, error } = await createSupabasePublicClient().rpc(
    "managed_appointment",
    { p_token_hash: hashLinkToken(token) },
  );
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    barbershopId: row.barbershop_id,
    slug: row.slug,
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    priceCop: row.price_cop,
    barberId: row.barber_id,
    barberName: row.barber_name,
    serviceNames: row.service_names,
    customerFirstName: row.customer_first_name,
    cancellationNoticeHours: row.cancellation_notice_hours,
    changeable: row.changeable,
  };
}

export type ManageResult = { ok: true } | { ok: false; error: ManageRefusal };

export async function cancelManagedAppointment(
  token: string,
): Promise<ManageResult> {
  if (!isLinkToken(token)) return { ok: false, error: "link_invalid" };
  const { error } = await createSupabasePublicClient().rpc(
    "cancel_appointment_by_token",
    { p_token_hash: hashLinkToken(token) },
  );
  return error ? { ok: false, error: toManageRefusal(error) } : { ok: true };
}

export async function rescheduleManagedAppointment(
  token: string,
  startsAt: Date,
): Promise<ManageResult> {
  if (!isLinkToken(token)) return { ok: false, error: "link_invalid" };
  const { error } = await createSupabasePublicClient().rpc(
    "reschedule_appointment_by_token",
    { p_token_hash: hashLinkToken(token), p_starts_at: startsAt.toISOString() },
  );
  return error ? { ok: false, error: toManageRefusal(error) } : { ok: true };
}
