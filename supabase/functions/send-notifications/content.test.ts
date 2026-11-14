import { describe, expect, it, vi } from "vitest";
import { emailData, type EmailDb } from "./content";
import type { QueuedMessage } from "./run-queue";

const SHOP = "aaaaaaaa-0000-4000-8000-000000000001";
const PAYMENT = "bbbbbbbb-0000-4000-8000-000000000001";

function message(payload: Record<string, unknown> = {}): QueuedMessage {
  return {
    id: "n1",
    leaseId: "l1",
    barbershopId: SHOP,
    appointmentId: null,
    type: "subscription_payment_registered",
    payload,
    attempts: 1,
    recipient: "dueno@example.com",
  };
}

function fakeDb(): EmailDb & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    barbershop: vi.fn(async (id) => {
      calls.push(["barbershop", id]);
      return id === SHOP
        ? {
            name: "La Esquina",
            slug: "la-esquina",
            status: "active" as const,
            plan: "standard",
            expiresOn: "2026-12-24",
          }
        : null;
    }),
    planPrice: vi.fn(async () => 25000),
    ownerName: vi.fn(async (id) => {
      calls.push(["ownerName", id]);
      return "Mario";
    }),
    payment: vi.fn(async (shopId, paymentId) => {
      calls.push(["payment", shopId, paymentId]);
      return { amountCop: 25000 };
    }),
  };
}

const env = {
  payInfo: { breB: null, nequi: null, email: null },
  siteUrl: "https://www.yapoin.com",
};

describe("emailData", () => {
  it("reads the barbershop, its price, its owner and the payment of the message", async () => {
    const db = fakeDb();
    expect(await emailData(db, message({ payment_id: PAYMENT }), env)).toEqual({
      barbershop: { name: "La Esquina", slug: "la-esquina" },
      ownerName: "Mario",
      subscription: {
        status: "active",
        expiresOn: "2026-12-24",
        planPriceCop: 25000,
      },
      payment: { amountCop: 25000 },
      payInfo: env.payInfo,
      siteUrl: env.siteUrl,
    });
  });

  it("always reads inside the barbershop of the message", async () => {
    const db = fakeDb();
    await emailData(db, message({ payment_id: PAYMENT }), env);
    expect(db.calls).toContainEqual(["payment", SHOP, PAYMENT]);
    expect(db.calls).toContainEqual(["ownerName", SHOP]);
  });

  it("never looks up a payment id that is not one", async () => {
    const db = fakeDb();
    const data = await emailData(db, message({ payment_id: "1 or 1=1" }), env);
    expect(db.payment).not.toHaveBeenCalled();
    expect(data?.payment).toBeNull();
  });

  it("lets a failed read reach the queue, which tries the message again", async () => {
    const db = fakeDb();
    db.ownerName = vi.fn(async () => {
      throw new Error("read_failed");
    });
    await expect(emailData(db, message(), env)).rejects.toThrow("read_failed");
  });

  it("gives nothing for a barbershop that no longer exists", async () => {
    const db = fakeDb();
    expect(
      await emailData(db, { ...message(), barbershopId: "other" }, env),
    ).toBeNull();
  });
});
