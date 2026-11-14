// Task 5.1: one run of the email queue, called every minute by pg_cron
// (migration add_notification_queue). It takes a batch of due messages, sends
// each one and reports how it went. The database decides the retries, the
// lease and the duplicates; the provider (task 5.2, decision 0008) is the
// Sender. No imports, so the Edge Function (Deno) and the tests (Vitest) use
// the same file.

export type QueuedMessage = {
  id: string;
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
  // complained), so trying again would not help.
  | { ok: false; permanent: boolean; error: string };

export interface Sender {
  send(message: QueuedMessage & { recipient: string }): Promise<SendResult>;
}

export type Outcome = "sent" | "retry" | "cancelled";

export interface Queue {
  claim(limit: number): Promise<QueuedMessage[]>;
  finish(id: string, outcome: Outcome, error?: string): Promise<void>;
}

export type RunSummary = {
  sent: number;
  retried: number;
  cancelled: number;
  // A report that did not reach the database. The message comes back when
  // its lease expires, so the provider's idempotency key must stop a resend.
  unreported: number;
};

export const BATCH_SIZE = 50;

export async function runQueue(
  queue: Queue,
  sender: Sender,
  limit: number = BATCH_SIZE,
): Promise<RunSummary> {
  const summary: RunSummary = {
    sent: 0,
    retried: 0,
    cancelled: 0,
    unreported: 0,
  };
  const messages = await queue.claim(limit);
  for (const message of messages) {
    const { outcome, error } = await deliver(sender, message);
    try {
      await queue.finish(message.id, outcome, error);
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
): Promise<{ outcome: Outcome; error?: string }> {
  if (!message.recipient)
    return { outcome: "cancelled", error: "no recipient" };
  let result: SendResult;
  try {
    result = await sender.send({ ...message, recipient: message.recipient });
  } catch (thrown) {
    // A timeout or a network failure: worth another try.
    return { outcome: "retry", error: errorText(thrown) };
  }
  if (result.ok) return { outcome: "sent" };
  return {
    outcome: result.permanent ? "cancelled" : "retry",
    error: result.error,
  };
}

function errorText(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
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
  barbershop_id: string;
  appointment_id: string | null;
  type: string;
  payload: unknown;
  attempts: number;
  recipient: string | null;
}): QueuedMessage {
  return {
    id: row.id,
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
