import "server-only";
import { toBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PAYMENT_DETAILS } from "../dominio/payment-details";
import {
  subscriptionNotice,
  type SubscriptionNotice,
} from "../dominio/subscription";

// How to pay, for the agenda notice (task 5.5): the plan's price and the
// founder's payment details (decision S2). Without a price, the notice
// promises to send the data.
export type PayInfo = {
  priceCop: number | null;
  breB: string | null;
  nequi: string | null;
  email: string | null;
};

export type AgendaSubscription = {
  notice: SubscriptionNotice;
  pay: PayInfo;
};

// The notice of the owner's active barbershop, read with their session.
export async function loadSubscriptionNotice(
  barbershopId: string,
  today: BogotaDate,
): Promise<AgendaSubscription | null> {
  const supabase = await createSupabaseServerClient();
  const { data: shop, error } = await supabase
    .from("barbershops")
    .select("subscription_status, plan, trial_ends_on, expires_on, created_at")
    .eq("id", barbershopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) return null;

  const notice = subscriptionNotice(
    {
      status: shop.subscription_status,
      plan: shop.plan,
      trialEndsOn: shop.trial_ends_on,
      expiresOn: shop.expires_on,
      createdOn: toBogotaDate(new Date(shop.created_at)),
    },
    today,
  );
  if (!notice) return null;

  // The barbershop's plan, or the first one on sale (as the emails do).
  const plans = supabase.from("plans").select("monthly_price_cop");
  const { data: plan, error: planError } = await (
    shop.plan ? plans.eq("code", shop.plan) : plans.eq("active", true)
  )
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (planError) throw new Error(planError.message);

  return {
    notice,
    pay: {
      priceCop: plan?.monthly_price_cop ?? null,
      ...PAYMENT_DETAILS,
    },
  };
}
