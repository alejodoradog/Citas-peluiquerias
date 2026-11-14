import { describe, expect, it, vi } from "vitest";
import {
  type Queue,
  type QueuedMessage,
  type Sender,
  SEND_WINDOW_MS,
  runQueue,
  sameSecret,
  secretIsUsable,
  toQueuedMessage,
} from "./run-queue";

function message(
  id: string,
  recipient: string | null = `${id}@example.com`,
): QueuedMessage {
  return {
    id,
    leaseId: `lease-${id}`,
    barbershopId: "shop",
    appointmentId: null,
    type: "subscription_expiring",
    payload: {},
    attempts: 1,
    recipient,
  };
}

function fakeQueue(messages: QueuedMessage[]) {
  const finished: {
    id: string;
    leaseId: string;
    outcome: string;
    code?: string;
  }[] = [];
  const queue: Queue = {
    claim: vi.fn(async () => messages),
    finish: vi.fn(async (id, leaseId, outcome, code) => {
      finished.push({ id, leaseId, outcome, code });
    }),
  };
  return { queue, finished };
}

const ok = { ok: true as const };

describe("runQueue", () => {
  it("sends each claimed message and reports it with its lease", async () => {
    const { queue, finished } = fakeQueue([message("a"), message("b")]);
    const sender: Sender = { send: vi.fn(async () => ok) };
    const summary = await runQueue(queue, sender);
    expect(queue.claim).toHaveBeenCalledWith(50);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(finished).toEqual([
      { id: "a", leaseId: "lease-a", outcome: "sent", code: undefined },
      { id: "b", leaseId: "lease-b", outcome: "sent", code: undefined },
    ]);
    expect(summary).toEqual({
      sent: 2,
      retried: 0,
      cancelled: 0,
      unreported: 0,
      skipped: 0,
    });
  });

  it("cancels a message with nobody to receive it, without sending", async () => {
    const { queue, finished } = fakeQueue([message("a", null)]);
    const sender: Sender = { send: vi.fn() };
    const summary = await runQueue(queue, sender);
    expect(sender.send).not.toHaveBeenCalled();
    expect(finished).toEqual([
      {
        id: "a",
        leaseId: "lease-a",
        outcome: "cancelled",
        code: "no_recipient",
      },
    ]);
    expect(summary.cancelled).toBe(1);
  });

  it("retries a passing failure and cancels a permanent one, keeping only codes", async () => {
    const { queue, finished } = fakeQueue([
      message("a"),
      message("b"),
      message("c"),
    ]);
    const sender: Sender = {
      send: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          permanent: false,
          code: "http_429",
        })
        .mockResolvedValueOnce({ ok: false, permanent: true, code: "bounced" })
        .mockRejectedValueOnce(new Error("timeout sending to c@example.com")),
    };
    const summary = await runQueue(queue, sender);
    expect(finished.map(({ outcome, code }) => ({ outcome, code }))).toEqual([
      { outcome: "retry", code: "http_429" },
      { outcome: "cancelled", code: "bounced" },
      { outcome: "retry", code: "send_failed" },
    ]);
    expect(JSON.stringify(finished)).not.toContain("@example.com");
    expect(summary).toMatchObject({ sent: 0, retried: 2, cancelled: 1 });
  });

  it("keeps going when a report fails, and counts it", async () => {
    const { queue } = fakeQueue([message("a"), message("b")]);
    queue.finish = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined);
    const sender: Sender = { send: vi.fn(async () => ok) };
    const summary = await runQueue(queue, sender, { limit: 10 });
    expect(queue.claim).toHaveBeenCalledWith(10);
    expect(summary).toMatchObject({ sent: 1, unreported: 1 });
  });

  it("stops sending before the lease expires and leaves the rest", async () => {
    const { queue, finished } = fakeQueue([
      message("a"),
      message("b"),
      message("c"),
    ]);
    let clock = 0;
    const sender: Sender = {
      send: vi.fn(async () => {
        clock += SEND_WINDOW_MS / 2;
        return ok;
      }),
    };
    const summary = await runQueue(queue, sender, { now: () => clock });
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(finished.map((f) => f.id)).toEqual(["a", "b"]);
    expect(summary).toMatchObject({ sent: 2, skipped: 1 });
  });
});

describe("the secret", () => {
  it("accepts only the exact secret", () => {
    expect(sameSecret("s3cret", "s3cret")).toBe(true);
    expect(sameSecret("s3cre", "s3cret")).toBe(false);
    expect(sameSecret("s3cret!", "s3cret")).toBe(false);
    expect(sameSecret("S3cret", "s3cret")).toBe(false);
    expect(sameSecret(null, "s3cret")).toBe(false);
  });

  it("never accepts when no secret is set", () => {
    expect(sameSecret("", "")).toBe(false);
  });

  it("must be at least 32 characters to be used", () => {
    expect(secretIsUsable("x".repeat(31))).toBe(false);
    expect(secretIsUsable("x".repeat(32))).toBe(true);
  });
});

describe("toQueuedMessage", () => {
  const row = {
    id: "a",
    lease_id: "lease",
    barbershop_id: "shop",
    appointment_id: "appt",
    type: "appointment_confirmed",
    payload: { old_starts_at: "2026-11-20T15:00:00Z" },
    attempts: 2,
    recipient: "c@example.com",
  };

  it("maps a row of claim_notifications", () => {
    expect(toQueuedMessage(row)).toEqual({
      id: "a",
      leaseId: "lease",
      barbershopId: "shop",
      appointmentId: "appt",
      type: "appointment_confirmed",
      payload: { old_starts_at: "2026-11-20T15:00:00Z" },
      attempts: 2,
      recipient: "c@example.com",
    });
  });

  it("keeps the payload an object", () => {
    expect(toQueuedMessage({ ...row, payload: null }).payload).toEqual({});
    expect(toQueuedMessage({ ...row, payload: [1] }).payload).toEqual({});
  });
});
