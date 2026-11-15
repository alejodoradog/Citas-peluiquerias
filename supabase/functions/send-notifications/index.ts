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
import {
  APPOINTMENT_EMAILS,
  type AppointmentDb,
  composeAppointmentEmail,
  composeMyAppointmentsEmail,
  type CustomerDb,
  MY_APPOINTMENTS_EMAIL,
} from "./appointment-emails.ts";
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
    // Task 5.6: the price of the barbershop's tier by its active barbers.
    async planPrice(barbershopId) {
      const data = rowOf(
        await db.rpc("subscription_quote", { p_barbershop_id: barbershopId }),
      );
      return data?.[0]?.price_cop ?? null;
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

// Task 5.3: the appointment of a message, with what its email shows, and the
// hash of the email's link. Every read filters by the message's barbershop.
function appointmentDb(db: SupabaseClient): AppointmentDb {
  return {
    async appointment(barbershopId, appointmentId) {
      const appointment = rowOf(
        await db
          .from("appointments")
          .select("status, starts_at, ends_at, barber_id, customer_id")
          .eq("barbershop_id", barbershopId)
          .eq("id", appointmentId)
          .maybeSingle(),
      );
      if (!appointment) return null;
      const [shop, barber, customer, lines] = await Promise.all([
        db
          .from("barbershops")
          .select("name, slug, address, locality, cancellation_notice_hours")
          .eq("id", barbershopId)
          .is("deleted_at", null)
          .maybeSingle(),
        db
          .from("barbers")
          .select("display_name")
          .eq("barbershop_id", barbershopId)
          .eq("id", appointment.barber_id)
          .maybeSingle(),
        db
          .from("customers")
          .select("full_name")
          .eq("barbershop_id", barbershopId)
          .eq("id", appointment.customer_id)
          .maybeSingle(),
        db
          .from("appointment_services")
          .select("position, services(name)")
          .eq("barbershop_id", barbershopId)
          .eq("appointment_id", appointmentId)
          .order("position"),
      ]);
      const shopRow = rowOf(shop);
      const barberRow = rowOf(barber);
      const customerRow = rowOf(customer);
      const lineRows = rowOf(lines) ?? [];
      if (!shopRow || !barberRow || !customerRow) return null;
      return {
        status: appointment.status,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        barberName: barberRow.display_name,
        serviceNames: lineRows
          .map((line) => (line.services as { name?: string } | null)?.name)
          .filter((name): name is string => typeof name === "string"),
        customerFirstName: customerRow.full_name.trim().split(/\s+/)[0] ?? "",
        barbershop: {
          name: shopRow.name,
          slug: shopRow.slug,
          address: shopRow.address,
          locality: shopRow.locality,
          cancellationNoticeHours: shopRow.cancellation_notice_hours,
        },
      };
    },
    async issueLink(barbershopId, appointmentId, tokenHash) {
      const { error } = await db.rpc("issue_appointment_link", {
        p_barbershop_id: barbershopId,
        p_appointment_id: appointmentId,
        p_token_hash: tokenHash,
      });
      if (error) throw new Error("link_failed");
    },
  };
}

// "Mis citas": the customer of a message, whether they have something
// upcoming, and the hash of the email's link.
function customerDb(db: SupabaseClient): CustomerDb {
  return {
    async customer(barbershopId, customerId) {
      const [customer, shop, upcoming] = await Promise.all([
        db
          .from("customers")
          .select("full_name, anonymized_at")
          .eq("barbershop_id", barbershopId)
          .eq("id", customerId)
          .maybeSingle(),
        db
          .from("barbershops")
          .select("name, slug, address, locality")
          .eq("id", barbershopId)
          .is("deleted_at", null)
          .maybeSingle(),
        db
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("barbershop_id", barbershopId)
          .eq("customer_id", customerId)
          .eq("status", "confirmed")
          .gt("starts_at", new Date().toISOString()),
      ]);
      const customerRow = rowOf(customer);
      const shopRow = rowOf(shop);
      if (upcoming.error) throw new Error("read_failed");
      if (!customerRow || customerRow.anonymized_at || !shopRow) return null;
      return {
        firstName: customerRow.full_name.trim().split(/\s+/)[0] ?? "",
        hasUpcoming: (upcoming.count ?? 0) > 0,
        barbershop: shopRow,
      };
    },
    async issueCustomerLink(barbershopId, customerId, tokenHash) {
      const { error } = await db.rpc("issue_customer_link", {
        p_barbershop_id: barbershopId,
        p_customer_id: customerId,
        p_token_hash: tokenHash,
      });
      if (error) throw new Error("link_failed");
    },
  };
}

function senderFromEnv(db: SupabaseClient): Sender | null {
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) return null;
  const content = emailDb(db);
  const appointments = appointmentDb(db);
  const customers = customerDb(db);
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
      if (message.type === MY_APPOINTMENTS_EMAIL) {
        return composeMyAppointmentsEmail(message, customers, {
          siteUrl: settings.siteUrl,
        });
      }
      if (APPOINTMENT_EMAILS.has(message.type)) {
        return composeAppointmentEmail(message, appointments, {
          siteUrl: settings.siteUrl,
        });
      }
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
