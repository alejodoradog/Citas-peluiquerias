import { describe, expect, it, vi } from "vitest";
import {
  type Queue,
  type QueuedMessage,
  type Sender,
  runQueue,
  sameSecret,
  toQueuedMessage,
} from "./run-queue";

function message(
  id: string,
  recipient: string | null = `${id}@example.com`,
): QueuedMessage {
  return {
    id,
    barbershopId: "shop",
    appointmentId: null,
    type: "subscription_expiring",
    payload: {},
    attempts: 1,
    recipient,
  };
}

function fakeQueue(messages: QueuedMessage[]) {
  const finished: { id: string; outcome: string; error?: string }[] = [];
  const queue: Queue = {
    claim: vi.fn(async () => messages),
    finish: vi.fn(async (id, outcome, error) => {
      finished.push({ id, outcome, error });
    }),
  };
  return { queue, finished };
}

describe("runQueue", () => {
  it("sends each claimed message and reports it", async () => {
    const { queue, finished } = fakeQueue([message("a"), message("b")]);
    const sender: Sender = { send: vi.fn(async () => ({ ok: true as const })) };
    const summary = await runQueue(queue, sender);
    expect(queue.claim).toHaveBeenCalledWith(50);
    expect(sender.send).toHaveBeenCalledTimes(2);
    expect(finished).toEqual([
      { id: "a", outcome: "sent", error: undefined },
      { id: "b", outcome: "sent", error: undefined },
    ]);
    expect(summary).toEqual({
      sent: 2,
      retried: 0,
      cancelled: 0,
      unreported: 0,
    });
  });

  it("cancels a message with nobody to receive it, without sending", async () => {
    const { queue, finished } = fakeQueue([message("a", null)]);
    const sender: Sender = { send: vi.fn() };
    const summary = await runQueue(queue, sender);
    expect(sender.send).not.toHaveBeenCalled();
    expect(finished).toEqual([
      { id: "a", outcome: "cancelled", error: "no recipient" },
    ]);
    expect(summary.cancelled).toBe(1);
  });

  it("retries a passing failure and cancels a permanent one", async () => {
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
          error: "rate limited",
        })
        .mockResolvedValueOnce({ ok: false, permanent: true, error: "bounced" })
        .mockRejectedValueOnce(new Error("timeout")),
    };
    const summary = await runQueue(queue, sender);
    expect(finished).toEqual([
      { id: "a", outcome: "retry", error: "rate limited" },
      { id: "b", outcome: "cancelled", error: "bounced" },
      { id: "c", outcome: "retry", error: "timeout" },
    ]);
    expect(summary).toEqual({
      sent: 0,
      retried: 2,
      cancelled: 1,
      unreported: 0,
    });
  });

  it("keeps going when a report fails, and counts it", async () => {
    const { queue } = fakeQueue([message("a"), message("b")]);
    queue.finish = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(undefined);
    const sender: Sender = { send: vi.fn(async () => ({ ok: true as const })) };
    const summary = await runQueue(queue, sender, 10);
    expect(queue.claim).toHaveBeenCalledWith(10);
    expect(summary).toEqual({
      sent: 1,
      retried: 0,
      cancelled: 0,
      unreported: 1,
    });
  });

  it("turns a thrown value that is not an Error into its text", async () => {
    const { queue, finished } = fakeQueue([message("a")]);
    const sender: Sender = {
      send: vi.fn().mockRejectedValueOnce("socket closed"),
    };
    await runQueue(queue, sender);
    expect(finished[0]).toEqual({
      id: "a",
      outcome: "retry",
      error: "socket closed",
    });
  });
});

describe("sameSecret", () => {
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
});

describe("toQueuedMessage", () => {
  const row = {
    id: "a",
    barbershop_id: "shop",
    appointment_id: "appt",
    type: "appointment_confirmed",
    payload: { manage_url: "https://example.com" },
    attempts: 2,
    recipient: "c@example.com",
  };

  it("maps a row of claim_notifications", () => {
    expect(toQueuedMessage(row)).toEqual({
      id: "a",
      barbershopId: "shop",
      appointmentId: "appt",
      type: "appointment_confirmed",
      payload: { manage_url: "https://example.com" },
      attempts: 2,
      recipient: "c@example.com",
    });
  });

  it("keeps the payload an object", () => {
    expect(toQueuedMessage({ ...row, payload: null }).payload).toEqual({});
    expect(toQueuedMessage({ ...row, payload: [1] }).payload).toEqual({});
  });
});
