// Task 5.1: the Edge Function that works the email queue. pg_cron calls it
// every minute through pg_net (private.request_notification_send), only when
// a message is due, with the secret kept in Vault.
//
// Secrets of the function (set in each Supabase project, never in the repo):
// - NOTIFICATIONS_SECRET: the same value as the Vault secret
//   notifications_secret.
// - The provider's key, from task 5.2 (decision 0008).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are given by Supabase.
//
// Until task 5.2 plugs the provider in there is no Sender: the function
// answers 503 and claims nothing, so due messages wait in the queue.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type Queue,
  type Sender,
  runQueue,
  sameSecret,
  toQueuedMessage,
} from "./run-queue.ts";

function senderFromEnv(): Sender | null {
  return null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  const expected = Deno.env.get("NOTIFICATIONS_SECRET") ?? "";
  const header = request.headers.get("Authorization");
  const given = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (request.method !== "POST" || !sameSecret(given, expected)) {
    return json(403, { error: "forbidden" });
  }

  const sender = senderFromEnv();
  if (!sender) return json(503, { error: "no_email_provider" });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const queue: Queue = {
    async claim(limit) {
      const { data, error } = await db.rpc("claim_notifications", {
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map(toQueuedMessage);
    },
    async finish(id, outcome, error) {
      const { error: finishError } = await db.rpc("finish_notification", {
        p_notification_id: id,
        p_outcome: outcome,
        p_error: error ?? null,
      });
      if (finishError) throw finishError;
    },
  };

  const summary = await runQueue(queue, sender);
  // Counts only: no address or content reaches the logs.
  console.log(JSON.stringify({ event: "notifications_run", ...summary }));
  return json(200, summary);
});
