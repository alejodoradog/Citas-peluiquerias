// Task 5.2 (decision 0008, point 7): Resend tells of bounces and complaints
// through a signed webhook. A delivery without a valid Svix signature gets
// 401 and nothing else. A bounce or a complaint is recorded on its message
// of the queue (record_email_event); Resend itself stops sending to an
// address that bounced for good (decision E3). Every other event is
// acknowledged and ignored.
//
// Secrets of the function (set in each Supabase project, never in the repo):
// - RESEND_WEBHOOK_SECRET: the "whsec_…" signing secret of the webhook in
//   Resend.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are given by Supabase.
// supabase/config.toml turns off the JWT check: Resend signs, not a user.
import { createClient } from "npm:@supabase/supabase-js@2";
import { eventCodeOf, notificationIdOf, verifySvix } from "./verify.ts";

const MAX_BODY_BYTES = 256 * 1024;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method" });
  // Resend's events are small; a large body is refused before reading it.
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) {
    return json(413, { error: "size" });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return json(413, { error: "size" });
  const verified = await verifySvix(
    Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "",
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
  );
  if (!verified) return json(401, { error: "signature" });

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: "body" });
  }
  const code = eventCodeOf(event);
  const notificationId = notificationIdOf(event);
  if (!code || !notificationId) return json(200, { ignored: true });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await db.rpc("record_email_event", {
    p_notification_id: notificationId,
    p_event: code,
  });
  // Counts and codes only: no address reaches the logs. A failure answers
  // 500, so Resend delivers the event again later.
  if (error) {
    console.error(JSON.stringify({ event: "email_event_failed", code }));
    return json(500, { error: "record" });
  }
  console.log(JSON.stringify({ event: "email_event", code }));
  return json(200, { recorded: true });
});
