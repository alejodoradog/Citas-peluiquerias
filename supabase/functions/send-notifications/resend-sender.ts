// Task 5.2 (decision 0008): the Sender of the queue, on Resend's HTTP API.
// - One call per email (decision E1). The queue sends one at a time; a small
//   gap keeps the team under Resend's 10 calls per second.
// - The queue's message id is the Idempotency-Key (rule Q4 of task 5.1):
//   Resend keeps it 24 hours, so a message that comes back after a lost
//   report is not sent twice. A 409 for that key means it already went out
//   (decision E2).
// - The id also travels as a tag, which the webhook reads (resend-webhook).
// - The result keeps a short code, never Resend's text, which may carry the
//   address.
// No imports but types, so Deno and Vitest share this file.
import type { Email } from "./render.ts";
import type { QueuedMessage, SendResult, Sender } from "./run-queue.ts";

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";
export const MIN_GAP_MS = 120;

type Message = QueuedMessage & { recipient: string };

export function resendSender({
  fetch,
  apiKey,
  from,
  compose,
  minGapMs = MIN_GAP_MS,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
}: {
  fetch: typeof globalThis.fetch;
  apiKey: string;
  from: string;
  // The email of a message, or null when it has no template.
  compose: (message: Message) => Promise<Email | null>;
  minGapMs?: number;
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => number;
}): Sender {
  let lastCall = Number.NEGATIVE_INFINITY;
  return {
    async send(message): Promise<SendResult> {
      const email = await compose(message);
      if (!email) return { ok: false, permanent: true, code: "no_template" };

      const wait = lastCall + minGapMs - now();
      if (wait > 0) await sleep(wait);
      lastCall = now();

      let response: Response;
      try {
        response = await fetch(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.id,
          },
          body: JSON.stringify({
            from,
            to: [message.recipient],
            subject: email.subject,
            html: email.html,
            text: email.text,
            tags: [{ name: "notification_id", value: message.id }],
          }),
        });
      } catch {
        return { ok: false, permanent: false, code: "network" };
      }
      return resultOf(response);
    },
  };
}

async function errorName(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { name?: unknown };
    return typeof body.name === "string" ? body.name : "";
  } catch {
    return "";
  }
}

async function resultOf(response: Response): Promise<SendResult> {
  if (response.ok) return { ok: true };
  const code = `http_${response.status}`;
  const name = await errorName(response);
  switch (response.status) {
    case 409:
      // Same key, other content: the first one was sent (decision E2).
      // Two calls at once with the same key: try again later.
      return name === "invalid_idempotent_request"
        ? { ok: true }
        : { ok: false, permanent: false, code };
    case 422:
      // The sender or the domain is a setup problem: keep the email until it
      // is fixed. Anything else in the request will not pass on a retry.
      return name === "invalid_from_address"
        ? { ok: false, permanent: false, code: "invalid_from" }
        : { ok: false, permanent: true, code };
    case 400:
      return { ok: false, permanent: true, code };
    default:
      // 401 and 403 (a bad key, a domain not verified), 429 and 5xx: a
      // setup problem or a passing one. The queue retries.
      return { ok: false, permanent: false, code };
  }
}
