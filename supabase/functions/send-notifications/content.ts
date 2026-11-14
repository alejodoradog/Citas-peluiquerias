// Task 5.2: what an email shows is read when it is sent, never kept in the
// queue (rule Q5 of task 5.1). Every read is filtered by the barbershop of
// the message, so a payload can never point at another barbershop's data.
// The database comes in as a small interface (the Edge Function passes its
// service client; the tests, a fake). No imports but types.
import type { EmailData } from "./render.ts";
import type { QueuedMessage } from "./run-queue.ts";

export type EmailDb = {
  barbershop(id: string): Promise<{
    name: string;
    slug: string;
    status: "trial" | "active" | "suspended";
    plan: string | null;
    expiresOn: string;
  } | null>;
  // The monthly price of a plan, or of the plan on sale when the barbershop
  // has none yet (in its trial).
  planPrice(code: string | null): Promise<number | null>;
  ownerName(barbershopId: string): Promise<string | null>;
  payment(
    barbershopId: string,
    paymentId: string,
  ): Promise<{
    amountCop: number;
  } | null>;
};

export type EmailEnv = {
  payInfo: EmailData["payInfo"];
  siteUrl: string;
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The data of one message, or null when its barbershop no longer exists.
export async function emailData(
  db: EmailDb,
  message: QueuedMessage,
  env: EmailEnv,
): Promise<EmailData | null> {
  const shop = await db.barbershop(message.barbershopId);
  if (!shop) return null;
  const paymentId = message.payload.payment_id;
  const [planPriceCop, ownerName, payment] = await Promise.all([
    db.planPrice(shop.plan),
    db.ownerName(message.barbershopId),
    typeof paymentId === "string" && ID.test(paymentId)
      ? db.payment(message.barbershopId, paymentId)
      : Promise.resolve(null),
  ]);
  return {
    barbershop: { name: shop.name, slug: shop.slug },
    ownerName,
    subscription: {
      status: shop.status,
      expiresOn: shop.expiresOn,
      planPriceCop,
    },
    payment,
    payInfo: env.payInfo,
    siteUrl: env.siteUrl,
  };
}
