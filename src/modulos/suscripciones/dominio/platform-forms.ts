import { addDays, isBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";
import type { ParseResult } from "@/lib/validacion/parse";

// The forms of the platform panel (task 5.4). The database checks the plan,
// the method, the reference and the reason again (migration
// add_subscription_payment_flow); the window of the payment day and the
// days to extend are rules of the app (decisions P3 and P8).

export const PAYMENT_METHODS = [
  "bre_b",
  "nequi",
  "daviplata",
  "bank_transfer",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Decision P8: a payment is registered on its day, or up to a month later.
export const PAYMENT_DAYS_BACK = 31;

export type PaymentField = "metodo" | "referencia" | "fecha";
export type PaymentFormCode = "reference_required" | "reference_too_long";

// P-03: the method, the bank's reference and the day it was paid.
export function parsePaymentForm(
  input: Record<PaymentField, string>,
  today: BogotaDate,
): ParseResult<
  { method: PaymentMethod; reference: string; paidOn: BogotaDate },
  PaymentFormCode
> {
  const errors: Partial<Record<PaymentField, PaymentFormCode | "invalid">> = {};
  const reference = input.referencia.trim();
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.metodo)) {
    errors.metodo = "invalid";
  }
  if (reference === "") errors.referencia = "reference_required";
  else if (reference.length > 100) errors.referencia = "reference_too_long";
  if (
    !isBogotaDate(input.fecha) ||
    input.fecha > today ||
    input.fecha < addDays(today, -PAYMENT_DAYS_BACK)
  ) {
    errors.fecha = "invalid";
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      method: input.metodo as PaymentMethod,
      reference,
      paidOn: input.fecha,
    },
  };
}

// The days of the payment date picker, today first.
export function paymentDayOptions(today: BogotaDate): BogotaDate[] {
  return Array.from({ length: PAYMENT_DAYS_BACK + 1 }, (_, index) =>
    addDays(today, -index),
  );
}

// P-04: "Días extra".
export const EXTEND_DAYS = [3, 7, 14, 30] as const;

export function parseExtendDays(value: string): number | null {
  const days = Number(value);
  return (EXTEND_DAYS as readonly number[]).includes(days) ? days : null;
}

export type VoidFormCode = "reason_required" | "reason_too_long";

// Voiding a payment needs a reason (decision P4); the database keeps it.
export function parseVoidReason(
  value: string,
): ParseResult<string, VoidFormCode> {
  const reason = value.trim();
  if (reason === "")
    return { success: false, errors: { motivo: "reason_required" } };
  if (reason.length > 200) {
    return { success: false, errors: { motivo: "reason_too_long" } };
  }
  return { success: true, data: reason };
}
