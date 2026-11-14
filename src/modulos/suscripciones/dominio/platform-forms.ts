import { z } from "zod";
import { addDays, isBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

// The forms of the platform panel (task 5.4). The database checks every rule
// again (migrations add_subscription_payment_flow and
// harden_subscription_payments, task 5.4b): the plan, the method, the
// reference, the reason, the window of the payment day (decision P8) and the
// days to extend (decision P3).

export const PAYMENT_METHODS = [
  "bre_b",
  "nequi",
  "daviplata",
  "bank_transfer",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Decision P8: a payment is registered on its day, or up to a month later.
export const PAYMENT_DAYS_BACK = 31;

// The first day a payment can be dated: a month back, but never before the
// barbershop existed (task 5.4b, B3).
export function earliestPaymentDay(
  today: BogotaDate,
  createdOn: BogotaDate,
): BogotaDate {
  const monthBack = addDays(today, -PAYMENT_DAYS_BACK);
  return createdOn > monthBack ? createdOn : monthBack;
}

export type PaymentField = "metodo" | "referencia" | "fecha";
export type PaymentFormCode = "reference_required" | "reference_too_long";

// P-03: the method, the bank's reference and the day it was paid, between
// `earliest` and today.
export function parsePaymentForm(
  input: Record<PaymentField, string>,
  today: BogotaDate,
  earliest: BogotaDate = addDays(today, -PAYMENT_DAYS_BACK),
): ParseResult<
  { method: PaymentMethod; reference: string; paidOn: BogotaDate },
  PaymentFormCode
> {
  const schema = z
    .object({
      metodo: z.enum(PAYMENT_METHODS, { error: "invalid" }),
      referencia: z
        .string()
        .trim()
        .min(1, "reference_required")
        .max(100, "reference_too_long"),
      fecha: z
        .string()
        .refine(
          (day) => isBogotaDate(day) && day >= earliest && day <= today,
          "invalid",
        ),
    })
    .transform((form) => ({
      method: form.metodo,
      reference: form.referencia,
      paidOn: form.fecha as BogotaDate,
    }));
  return parseWith<typeof schema, PaymentFormCode>(schema, input);
}

// The days of the payment date picker, today first, back to `earliest`.
export function paymentDayOptions(
  today: BogotaDate,
  earliest: BogotaDate = addDays(today, -PAYMENT_DAYS_BACK),
): BogotaDate[] {
  const days: BogotaDate[] = [];
  for (let day = today; day >= earliest; day = addDays(day, -1)) {
    days.push(day);
  }
  return days;
}

// P-04: "Días extra". The database refuses more than 30 past the end of the
// trial, or past today if it already ended.
export const EXTEND_DAYS = [3, 7, 14, 30] as const;

const extendDaysSchema = z.coerce
  .number()
  .refine((days) => (EXTEND_DAYS as readonly number[]).includes(days));

export function parseExtendDays(value: string): number | null {
  const days = extendDaysSchema.safeParse(value);
  return days.success ? days.data : null;
}

export type VoidFormCode = "reason_required" | "reason_too_long";

const voidReasonSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, "reason_required")
    .max(200, "reason_too_long"),
});

// Voiding a payment needs a reason (decision P4); the database keeps it.
export function parseVoidReason(
  value: string,
): ParseResult<string, VoidFormCode> {
  const result = parseWith<typeof voidReasonSchema, VoidFormCode>(
    voidReasonSchema,
    { motivo: value },
  );
  return result.success ? { success: true, data: result.data.motivo } : result;
}
