import "server-only";
import { z } from "zod";
import {
  addDays,
  startOfBogotaDay,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "../dominio/platform-forms";
import type { Phase, SubscriptionStatus } from "../dominio/subscription";
import { toPlatformRefusal, type PlatformRefusal } from "./platform-errors";

// The platform panel (task 5.4), read and written with the super admin's own
// session. The pages call requireSuperAdmin first; the database checks again
// in every function (private.is_super_admin), and its super_admin_read
// policies let that session read barbershops, payments, appointments and
// barbers. The owner's email comes only from platform_barbershops.


export type PlatformRow = {
  id: string;
  name: string;
  slug: string;
  locality: string | null;
  subscriptionStatus: SubscriptionStatus;
  plan: string | null;
  trialEndsOn: BogotaDate;
  expiresOn: BogotaDate;
  createdAt: Date;
  phase: Phase;
  owner: { name: string | null; phone: string | null; email: string | null };
};

const PHASES = [
  "active",
  "awaiting_first_payment",
  "expired",
  "suspended",
] as const;

type RpcRow = {
  id: string;
  name: string;
  slug: string;
  locality: string | null;
  subscription_status: SubscriptionStatus;
  plan: string | null;
  trial_ends_on: string;
  expires_on: string;
  created_at: string;
  phase: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
};

function toRow(row: RpcRow): PlatformRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    locality: row.locality,
    subscriptionStatus: row.subscription_status,
    plan: row.plan,
    trialEndsOn: row.trial_ends_on,
    expiresOn: row.expires_on,
    createdAt: new Date(row.created_at),
    phase: z.enum(PHASES).parse(row.phase),
    owner: {
      name: row.owner_name,
      phone: row.owner_phone,
      email: row.owner_email,
    },
  };
}

// P-01: every barbershop, or those whose name, link, owner or email has the
// words searched.
export async function listPlatformBarbershops(
  search?: string,
): Promise<PlatformRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "platform_barbershops",
    search ? { p_search: search } : {},
  );
  if (error) throw new Error(error.message);
  return (data as RpcRow[]).map(toRow);
}

export type PlatformPayment = {
  id: string;
  amountCop: number;
  method: PaymentMethod;
  reference: string;
  paidOn: BogotaDate;
  coversFrom: BogotaDate;
  coversUntil: BogotaDate;
  // The order the payments were registered in, which the replay follows
  // among payments of the same day.
  createdAt: Date;
  voided: { at: Date; reason: string } | null;
};

export type PlatformDetail = PlatformRow & {
  payments: PlatformPayment[];
  // P-02's numbers: appointments of last month, active barbers.
  appointmentsLastMonth: number;
  activeBarbers: number;
};

// P-02, or null for a barbershop that does not exist (or was deleted).
export async function loadPlatformBarbershop(
  id: string,
  today: BogotaDate,
): Promise<PlatformDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("platform_barbershops", {})
    .eq("id", id);
  if (error) throw new Error(error.message);
  const found = (data as RpcRow[])[0];
  if (!found) return null;

  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const firstOfLastMonth = `${addDays(firstOfMonth, -1).slice(0, 7)}-01`;
  const [payments, appointments, barbers] = await Promise.all([
    supabase
      .from("subscription_payments")
      .select(
        "id, amount_cop, method, reference, paid_on, covers_from, covers_until, voided_at, void_reason, created_at",
      )
      .eq("barbershop_id", id)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", id)
      .in("status", ["confirmed", "attended", "no_show"])
      .gte("starts_at", startOfBogotaDay(firstOfLastMonth).toISOString())
      .lt("starts_at", startOfBogotaDay(firstOfMonth).toISOString()),
    supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", id)
      .eq("active", true),
  ]);
  if (payments.error) throw new Error(payments.error.message);
  if (appointments.error) throw new Error(appointments.error.message);
  if (barbers.error) throw new Error(barbers.error.message);

  return {
    ...toRow(found),
    payments: payments.data.map((row) => ({
      id: row.id,
      amountCop: row.amount_cop,
      method: row.method,
      reference: row.reference,
      paidOn: row.paid_on,
      coversFrom: row.covers_from,
      coversUntil: row.covers_until,
      createdAt: new Date(row.created_at),
      voided:
        row.voided_at && row.void_reason
          ? { at: new Date(row.voided_at), reason: row.void_reason }
          : null,
    })),
    appointmentsLastMonth: appointments.count ?? 0,
    activeBarbers: barbers.count ?? 0,
  };
}

// The plan a payment buys: the spec sells one plan (decision 0006), the
// active one first in the catalog, at its monthly price.
export async function currentPlan(): Promise<{
  code: string;
  monthlyPriceCop: number;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, monthly_price_cop")
    .eq("active", true)
    .order("sort_order")
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return { code: data.code, monthlyPriceCop: data.monthly_price_cop };
}

// P-06: the payments of this month and the last one, voided ones included
// (the domain leaves them out of the sums).
export async function loadRecentPayments(today: BogotaDate) {
  const firstOfLastMonth = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("amount_cop, paid_on, voided_at")
    .gte("paid_on", firstOfLastMonth);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    amountCop: row.amount_cop,
    paidOn: row.paid_on,
    voided: row.voided_at !== null,
  }));
}

export type PlatformResult =
  { ok: true } | { ok: false; error: PlatformRefusal };

const done = (
  error: { code?: string; hint?: string | null } | null,
): PlatformResult =>
  error ? { ok: false, error: toPlatformRefusal(error) } : { ok: true };

export async function registerPayment(payment: {
  barbershopId: string;
  plan: string;
  method: PaymentMethod;
  reference: string;
  paidOn: BogotaDate;
}): Promise<PlatformResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_subscription_payment", {
    p_barbershop_id: payment.barbershopId,
    p_plan: payment.plan,
    p_method: payment.method,
    p_reference: payment.reference,
    p_paid_on: payment.paidOn,
  });
  return done(error);
}

export async function voidPayment(
  paymentId: string,
  reason: string,
): Promise<PlatformResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_subscription_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  return done(error);
}

export async function suspendBarbershop(id: string): Promise<PlatformResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("suspend_barbershop", {
    p_barbershop_id: id,
  });
  return done(error);
}

export async function reactivateBarbershop(
  id: string,
): Promise<PlatformResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reactivate_barbershop", {
    p_barbershop_id: id,
  });
  return done(error);
}

export async function extendTrial(
  id: string,
  until: BogotaDate,
): Promise<PlatformResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("extend_trial", {
    p_barbershop_id: id,
    p_until: until,
  });
  return done(error);
}
