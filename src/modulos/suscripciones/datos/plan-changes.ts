import "server-only";
import { z } from "zod";
import type { BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "../dominio/platform-forms";
import { toPlatformRefusal, type PlatformRefusal } from "./platform-errors";

// "Cambiar plan" (task 7.8b), read and written with the session of whoever
// acts: the owner asks for their establishment, the super admin decides.
// The database checks both again (migration add_plan_change_requests).

export type PlanChangeStatus =
  "pending" | "accepted" | "rejected" | "cancelled";

export type PlanChange = {
  id: string;
  barbershopId: string;
  barbershopName: string;
  ownerName: string | null;
  fromPlan: string;
  toPlan: string;
  amountCop: number;
  status: PlanChangeStatus;
  requestedAt: Date;
  decidedAt: Date | null;
  rejectReason: string | null;
  payment: {
    method: PaymentMethod;
    reference: string;
    paidOn: BogotaDate;
  } | null;
  voided: { at: Date; reason: string } | null;
};

type PlanChangeRow = {
  id: string;
  barbershop_id: string;
  barbershop_name: string;
  owner_name: string | null;
  from_plan: string;
  to_plan: string;
  amount_cop: number;
  status: PlanChangeStatus;
  requested_at: string;
  decided_at: string | null;
  reject_reason: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  paid_on: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

function toPlanChange(row: PlanChangeRow): PlanChange {
  return {
    id: row.id,
    barbershopId: row.barbershop_id,
    barbershopName: row.barbershop_name,
    ownerName: row.owner_name,
    fromPlan: row.from_plan,
    toPlan: row.to_plan,
    amountCop: row.amount_cop,
    status: row.status,
    requestedAt: new Date(row.requested_at),
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    rejectReason: row.reject_reason,
    payment:
      row.method && row.reference && row.paid_on
        ? { method: row.method, reference: row.reference, paidOn: row.paid_on }
        : null,
    // Voided is the date alone (the reason is always there now; B2).
    voided: row.voided_at
      ? { at: new Date(row.voided_at), reason: row.void_reason ?? "" }
      : null,
  };
}

// The owner's view (D "Plan"): the plan chosen, what it allows, its active
// professionals and the request still pending, if any.
export type OwnPlan = {
  code: string;
  name: string;
  maxProfessionals: number | null;
  activeProfessionals: number;
  // What the next monthly payment costs (null "por acuerdo").
  nextPaymentCop: number | null;
  pending: {
    id: string;
    toPlan: string;
    amountCop: number;
    requestedAt: Date;
  } | null;
  // What moving up to plan 2 would cost now, as private.plan_change_cop
  // works it out (the database decides again when asked): the difference of
  // the monthly prices with a payment that stands, plan 2's first month
  // without one. Null when this plan cannot move up here.
  upgradeCop: number | null;
};

export async function loadOwnPlan(
  barbershopId: string,
): Promise<OwnPlan | null> {
  if (!z.uuid().safeParse(barbershopId).success) return null;
  const supabase = await createSupabaseServerClient();
  const [shop, quote, pending, prices, standing] = await Promise.all([
    supabase
      .from("barbershops")
      .select(
        "selected_plan, plans!barbershops_selected_plan_fkey(code, name, max_barbers)",
      )
      .eq("id", barbershopId)
      .maybeSingle(),
    supabase.rpc("subscription_quote", { p_barbershop_id: barbershopId }),
    supabase
      .from("plan_change_requests")
      .select("id, to_plan, amount_cop, requested_at")
      .eq("barbershop_id", barbershopId)
      .eq("status", "pending")
      .maybeSingle(),
    supabase
      .from("plans")
      .select("code, monthly_price_cop, first_payment_cop")
      .in("code", ["standard", "plus"]),
    supabase
      .from("subscription_payments")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
      .is("voided_at", null),
  ]);
  if (shop.error) throw new Error(shop.error.message);
  if (quote.error) throw new Error(quote.error.message);
  if (pending.error) throw new Error(pending.error.message);
  if (prices.error) throw new Error(prices.error.message);
  if (standing.error) throw new Error(standing.error.message);
  const priceOf = (code: string) =>
    prices.data.find((row) => row.code === code);
  const from = priceOf("standard");
  const to = priceOf("plus");
  const plan = shop.data?.plans as
    | { code: string; name: string; max_barbers: number | null }
    | null
    | undefined;
  const priced = quote.data?.[0];
  if (!plan || !priced) return null;
  return {
    code: plan.code,
    name: plan.name,
    maxProfessionals: plan.max_barbers,
    activeProfessionals: priced.active_barbers,
    nextPaymentCop: priced.price_cop,
    pending: pending.data
      ? {
          id: pending.data.id,
          toPlan: pending.data.to_plan,
          amountCop: pending.data.amount_cop,
          requestedAt: new Date(pending.data.requested_at),
        }
      : null,
    upgradeCop:
      plan.code !== "standard" ||
      !from?.monthly_price_cop ||
      !to?.monthly_price_cop
        ? null
        : (standing.count ?? 0) > 0
          ? to.monthly_price_cop - from.monthly_price_cop
          : (to.first_payment_cop ?? to.monthly_price_cop),
  };
}

// Why the owner's request was refused:
// - not_offered: the establishment is not on plan 1 (plan_change_not_offered);
// - pending: there is one pending already (plan_change_pending);
// - not_found / unknown: anything else.
export type OwnerPlanRefusal =
  "not_offered" | "pending" | "not_found" | "unknown";

function ownerRefusal(error: {
  code?: string;
  hint?: string | null;
}): OwnerPlanRefusal {
  if (error.hint === "plan_change_not_offered") return "not_offered";
  if (error.hint === "plan_change_pending") return "pending";
  if (error.code === "P0002" || error.code === "42501") return "not_found";
  return "unknown";
}

export async function requestPlanChange(
  barbershopId: string,
  toPlan: string,
): Promise<{ ok: true } | { ok: false; error: OwnerPlanRefusal }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_plan_change", {
    p_barbershop_id: barbershopId,
    p_to_plan: toPlan,
  });
  return error ? { ok: false, error: ownerRefusal(error) } : { ok: true };
}

export async function cancelPlanChange(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: OwnerPlanRefusal }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_plan_change", {
    p_request_id: requestId,
  });
  return error ? { ok: false, error: ownerRefusal(error) } : { ok: true };
}

// The super admin's view: the pending ones ("Solicitudes"), or every one of
// an establishment (its ficha).
export async function listPlanChanges(filter: {
  barbershopId?: string;
  pendingOnly?: boolean;
}): Promise<PlanChange[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_plan_changes", {
    ...(filter.barbershopId ? { p_barbershop_id: filter.barbershopId } : {}),
    p_pending_only: filter.pendingOnly ?? false,
  });
  if (error) throw new Error(error.message);
  return (data as PlanChangeRow[]).map(toPlanChange);
}

export type PlatformPlanResult =
  { ok: true } | { ok: false; error: PlatformRefusal };

const done = (
  error: { code?: string; hint?: string | null } | null,
): PlatformPlanResult =>
  error ? { ok: false, error: toPlatformRefusal(error) } : { ok: true };

export async function acceptPlanChange(accept: {
  requestId: string;
  method: PaymentMethod;
  reference: string;
  paidOn: BogotaDate;
  amountCop: number;
}): Promise<PlatformPlanResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_plan_change", {
    p_request_id: accept.requestId,
    p_method: accept.method,
    p_reference: accept.reference,
    p_paid_on: accept.paidOn,
    p_amount_cop: accept.amountCop,
  });
  return done(error);
}

export async function rejectPlanChange(
  requestId: string,
  reason: string,
): Promise<PlatformPlanResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reject_plan_change", {
    p_request_id: requestId,
    p_reason: reason,
  });
  return done(error);
}

export async function voidPlanChange(
  requestId: string,
  reason: string,
): Promise<PlatformPlanResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_plan_change", {
    p_request_id: requestId,
    p_reason: reason,
  });
  return done(error);
}
