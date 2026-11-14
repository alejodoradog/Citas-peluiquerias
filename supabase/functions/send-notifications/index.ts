// Task 5.1: the Edge Function that works the email queue. pg_cron calls it
// every minute through pg_net (private.request_notification_send), only when
// a message is due, with the secret kept in Vault.
//
// Secrets of the function (set in each Supabase project, never in the repo):
// - NOTIFICATIONS_SECRET: the same value as the Vault secret
//   notifications_secret, at least 32 characters.
// - RESEND_API_KEY and EMAIL_FROM (task 5.2, decision 0008), for instance
//   "Yapoin <citas@yapoin.com>". Without both there is no Sender: the
//   function answers 503 and claims nothing, so due messages wait in the
//   queue (local, the CI and any project without a key).
// - PAYMENT_BRE_B, PAYMENT_NEQUI and PAYMENT_EMAIL: how owners pay (decision
//   E5). Optional; without them the emails promise to send the data.
// - SITE_URL: the app, for the button of the emails (www.yapoin.com).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are given by Supabase.
//
// pg_net stops waiting after 5 s, so the function answers 202 at once and
// works the batch in the background (EdgeRuntime.waitUntil).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { emailData, type EmailDb } from "./content.ts";
import { composeEmail } from "./render.ts";
import { resendSender } from "./resend-sender.ts";
import {
  type Queue,
  type Sender,
  runQueue,
  sameSecret,
  secretIsUsable,
  toQueuedMessage,
} from "./run-queue.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const env = (name: string) => Deno.env.get(name)?.trim() || null;

// A read that fails throws, so the queue tries the message again later
// (run-queue turns it into a retry); null means only that the row does not
// exist.
function rowOf<T>(result: { data: T | null; error: unknown }): T | null {
  if (result.error) throw new Error("read_failed");
  return result.data;
}

// Every read filters by the barbershop of the message (content.ts).
function emailDb(db: SupabaseClient): EmailDb {
  return {
    async barbershop(id) {
      const data = rowOf(
        await db
          .from("barbershops")
          .select("name, slug, subscription_status, plan, expires_on")
          .eq("id", id)
          .maybeSingle(),
      );
      return data
        ? {
            name: data.name,
            slug: data.slug,
            status: data.subscription_status,
            plan: data.plan,
            expiresOn: data.expires_on,
          }
        : null;
    },
    async planPrice(code) {
      const query = db.from("plans").select("monthly_price_cop");
      const data = rowOf(
        await (code
          ? query.eq("code", code)
          : query.eq("active", true).order("sort_order")
        )
          .limit(1)
          .maybeSingle(),
      );
      return data?.monthly_price_cop ?? null;
    },
    async ownerName(barbershopId) {
      const data = rowOf(
        await db
          .from("memberships")
          .select("profiles(full_name)")
          .eq("barbershop_id", barbershopId)
          .eq("role", "owner")
          .order("created_at")
          .order("user_id")
          .limit(1)
          .maybeSingle(),
      );
      const profile = data?.profiles as { full_name?: string } | null;
      return profile?.full_name?.split(" ")[0] ?? null;
    },
    async payment(barbershopId, paymentId) {
      const data = rowOf(
        await db
          .from("subscription_payments")
          .select("amount_cop")
          .eq("barbershop_id", barbershopId)
          .eq("id", paymentId)
          // A payment voided before the notice left is not announced.
          .is("voided_at", null)
          .maybeSingle(),
      );
      return data ? { amountCop: data.amount_cop } : null;
    },
  };
}

function senderFromEnv(db: SupabaseClient): Sender | null {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) return null;
  const content = emailDb(db);
  const settings = {
    payInfo: {
      breB: env("PAYMENT_BRE_B"),
      nequi: env("PAYMENT_NEQUI"),
      email: env("PAYMENT_EMAIL"),
    },
    siteUrl: env("SITE_URL") ?? "https://www.yapoin.com",
  };
  return resendSender({
    fetch,
    apiKey,
    from,
    async compose(message) {
      const data = await emailData(content, message, settings);
      return composeEmail(message.type, message.payload, data);
    },
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve((request) => {
  const expected = Deno.env.get("NOTIFICATIONS_SECRET") ?? "";
  if (!secretIsUsable(expected)) return json(503, { error: "misconfigured" });
  const header = request.headers.get("Authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (request.method !== "POST" || !sameSecret(given, expected)) {
    return json(403, { error: "forbidden" });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const sender = senderFromEnv(db);
  if (!sender) return json(503, { error: "no_email_provider" });
  const queue: Queue = {
    async claim(limit) {
      const { data, error } = await db.rpc("claim_notifications", {
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map(toQueuedMessage);
    },
    async finish(id, leaseId, outcome, code) {
      const { error } = await db.rpc("finish_notification", {
        p_notification_id: id,
        p_lease_id: leaseId,
        p_outcome: outcome,
        p_error: code ?? null,
      });
      if (error) throw error;
    },
  };

  EdgeRuntime.waitUntil(
    runQueue(queue, sender).then(
      // Counts only: no address or content reaches the logs.
      (summary) =>
        console.log(JSON.stringify({ event: "notifications_run", ...summary })),
      () =>
        console.error(JSON.stringify({ event: "notifications_run_failed" })),
    ),
  );
  return json(202, { accepted: true });
});
