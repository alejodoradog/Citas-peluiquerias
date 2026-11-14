import { describe, expect, it, vi } from "vitest";
import type { Email } from "./render";
import { RESEND_EMAILS_URL, resendSender } from "./resend-sender";
import type { QueuedMessage } from "./run-queue";

const MESSAGE: QueuedMessage & { recipient: string } = {
  id: "11111111-2222-4333-8444-555555555555",
  leaseId: "lease",
  barbershopId: "shop",
  appointmentId: null,
  type: "subscription_expiring",
  payload: {},
  attempts: 1,
  recipient: "dueno@example.com",
};
const EMAIL: Email = { subject: "Asunto", html: "<p>Hola</p>", text: "Hola" };

function sender(
  respond: () => Response | Promise<Response>,
  extra: Partial<Parameters<typeof resendSender>[0]> = {},
) {
  const fetch = vi.fn(async () => respond());
  return {
    fetch,
    sender: resendSender({
      fetch: fetch as unknown as typeof globalThis.fetch,
      apiKey: "re_test",
      from: "Yapoin <citas@yapoin.com>",
      compose: async () => EMAIL,
      sleep: async () => undefined,
      ...extra,
    }),
  };
}

const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe("resendSender", () => {
  it("posts the email with the message id as idempotency key and tag", async () => {
    const { fetch, sender: s } = sender(() => reply(200, { id: "re_1" }));
    expect(await s.send(MESSAGE)).toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_EMAILS_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe(MESSAGE.id);
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Yapoin <citas@yapoin.com>",
      to: ["dueno@example.com"],
      subject: "Asunto",
      html: "<p>Hola</p>",
      text: "Hola",
      tags: [{ name: "notification_id", value: MESSAGE.id }],
    });
  });

  it("counts a 409 for the same key as sent (decision E2)", async () => {
    const { sender: s } = sender(() =>
      reply(409, { name: "invalid_idempotent_request" }),
    );
    expect(await s.send(MESSAGE)).toEqual({ ok: true });
    const { sender: other } = sender(() =>
      reply(409, { name: "concurrent_idempotent_requests" }),
    );
    expect(await other.send(MESSAGE)).toEqual({
      ok: false,
      permanent: false,
      code: "http_409",
    });
  });

  it("retries what is passing or a setup problem", async () => {
    for (const status of [401, 403, 429, 500, 503]) {
      const { sender: s } = sender(() =>
        reply(status, { message: "dueno@example.com bad" }),
      );
      expect(await s.send(MESSAGE)).toEqual({
        ok: false,
        permanent: false,
        code: `http_${status}`,
      });
    }
    const { sender: from } = sender(() =>
      reply(422, { name: "invalid_from_address" }),
    );
    expect(await from.send(MESSAGE)).toEqual({
      ok: false,
      permanent: false,
      code: "invalid_from",
    });
  });

  it("gives up on a request that will not pass", async () => {
    for (const status of [400, 422]) {
      const { sender: s } = sender(() =>
        reply(status, { name: "validation_error" }),
      );
      expect(await s.send(MESSAGE)).toEqual({
        ok: false,
        permanent: true,
        code: `http_${status}`,
      });
    }
  });

  it("never keeps Resend's text, which may carry the address", async () => {
    const { sender: s } = sender(() =>
      reply(500, { message: "failed for dueno@example.com" }),
    );
    expect(JSON.stringify(await s.send(MESSAGE))).not.toContain("@");
  });

  it("retries a network failure", async () => {
    const { sender: s } = sender(() => {
      throw new TypeError("network down");
    });
    expect(await s.send(MESSAGE)).toEqual({
      ok: false,
      permanent: false,
      code: "network",
    });
  });

  it("cancels a type without a template, without calling Resend", async () => {
    const { fetch, sender: s } = sender(() => reply(200), {
      compose: async () => null,
    });
    expect(await s.send(MESSAGE)).toEqual({
      ok: false,
      permanent: true,
      code: "no_template",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits between calls to stay under the rate limit", async () => {
    const sleep = vi.fn(async () => undefined);
    let clock = 1000;
    const { sender: s } = sender(() => reply(200), {
      sleep,
      now: () => clock,
      minGapMs: 120,
    });
    await s.send(MESSAGE);
    clock += 50;
    await s.send(MESSAGE);
    expect(sleep).toHaveBeenCalledWith(70);
  });
});
