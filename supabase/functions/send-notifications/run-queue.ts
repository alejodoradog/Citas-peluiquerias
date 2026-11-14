// Task 5.1: one run of the email queue, called every minute by pg_cron
// (migration add_notification_queue). It takes a batch of due messages, sends
// each one and reports how it went. The database decides the retries, the
// lease and the duplicates; the provider (task 5.2, decision 0008) is the
// Sender. No imports, so the Edge Function (Deno) and the tests (Vitest) use
// the same file.

export type QueuedMessage = {
  id: string;
  // The lease of this run: only it finishes the message (finish_notification).
  leaseId: string;
  barbershopId: string;
  appointmentId: string | null;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  // Null when nobody should receive it (a deleted customer, a barber
  // without notices): the message is cancelled.
  recipient: string | null;
};

export type SendResult =
  | { ok: true }
  // permanent: the provider refused the address for good (it bounced, it
  // complained), so trying again would not help. code: a short code such as
  // "bounced" or "http_500", never the provider's text, which may carry the
  // address.
  | { ok: false; permanent: boolean; code: string };

export interface Sender {
  send(message: QueuedMessage & { recipient: string }): Promise<SendResult>;
}

export type Outcome = "sent" | "retry" | "cancelled";

export interface Queue {
  claim(limit: number): Promise<QueuedMessage[]>;
  finish(
    id: string,
    leaseId: string,
    outcome: Outcome,
    code?: string,
  ): Promise<void>;
}

export type RunSummary = {
  sent: number;
  retried: number;
  cancelled: number;
  // A report that did not reach the database. The message comes back when
  // its lease expires, so the provider's idempotency key must stop a resend.
  unreported: number;
  // Left untouched because the lease was about to expire: another run takes
  // them later.
  skipped: number;
};

export const BATCH_SIZE = 50;
// The lease of claim_notifications is 5 minutes. The run stops sending a
// minute before, so it never sends a message another run may already hold.
export const SEND_WINDOW_MS = 4 * 60_000;

export async function runQueue(
  queue: Queue,
  sender: Sender,
  {
    limit = BATCH_SIZE,
    now = Date.now,
  }: { limit?: number; now?: () => number } = {},
): Promise<RunSummary> {
  const summary: RunSummary = {
    sent: 0,
    retried: 0,
    cancelled: 0,
    unreported: 0,
    skipped: 0,
  };
  const startedAt = now();
  const messages = await queue.claim(limit);
  for (const message of messages) {
    if (now() - startedAt >= SEND_WINDOW_MS) {
      summary.skipped += 1;
      continue;
    }
    const { outcome, code } = await deliver(sender, message);
    try {
      await queue.finish(message.id, message.leaseId, outcome, code);
    } catch {
      summary.unreported += 1;
      continue;
    }
    if (outcome === "sent") summary.sent += 1;
    else if (outcome === "retry") summary.retried += 1;
    else summary.cancelled += 1;
  }
  return summary;
}

async function deliver(
  sender: Sender,
  message: QueuedMessage,
): Promise<{ outcome: Outcome; code?: string }> {
  if (!message.recipient) return { outcome: "cancelled", code: "no_recipient" };
  let result: SendResult;
  try {
    result = await sender.send({ ...message, recipient: message.recipient });
  } catch {
    // A timeout or a network failure: worth another try. The thrown text is
    // not kept, since it may carry the address.
    return { outcome: "retry", code: "send_failed" };
  }
  if (result.ok) return { outcome: "sent" };
  return {
    outcome: result.permanent ? "cancelled" : "retry",
    code: result.code,
  };
}

// The secret must be long enough to not be guessed; a short one means the
// function is not set up yet.
export const MIN_SECRET_LENGTH = 32;

export function secretIsUsable(expected: string): boolean {
  return expected.length >= MIN_SECRET_LENGTH;
}

// The secret pg_cron sends, compared in constant time so a wrong guess does
// not tell how much of it was right.
export function sameSecret(given: string | null, expected: string): boolean {
  if (given === null || expected.length === 0) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i += 1) diff |= (a[i] ?? 0) ^ b[i]!;
  return diff === 0;
}

// The rows of claim_notifications, in the shape of the run.
export function toQueuedMessage(row: {
  id: string;
  lease_id: string;
  barbershop_id: string;
  appointment_id: string | null;
  type: string;
  payload: unknown;
  attempts: number;
  recipient: string | null;
}): QueuedMessage {
  return {
    id: row.id,
    leaseId: row.lease_id,
    barbershopId: row.barbershop_id,
    appointmentId: row.appointment_id,
    type: row.type,
    payload:
      row.payload !== null &&
      typeof row.payload === "object" &&
      !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    attempts: row.attempts,
    recipient: row.recipient,
  };
}
