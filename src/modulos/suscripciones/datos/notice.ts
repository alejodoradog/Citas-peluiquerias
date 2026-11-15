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

  // What it pays by its active barbers (task 5.6); null when it is agreed.
  // Without it, the notice still shows and promises the payment data.
  const { data: quote, error: quoteError } = await supabase.rpc(
    "subscription_quote",
    { p_barbershop_id: barbershopId },
  );
  if (quoteError)
    console.error(
      JSON.stringify({ event: "quote_failed", code: quoteError.code }),
    );

  return {
    notice,
    pay: {
      priceCop: quote?.[0]?.price_cop ?? null,
      ...PAYMENT_DETAILS,
    },
  };
}
