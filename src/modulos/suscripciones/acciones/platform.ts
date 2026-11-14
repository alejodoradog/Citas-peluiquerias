"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addDays, now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  currentPlan,
  extendTrial as extendTrialData,
  loadPlatformBarbershop,
  reactivateBarbershop as reactivateData,
  registerPayment as registerPaymentData,
  suspendBarbershop as suspendData,
  voidPayment as voidPaymentData,
} from "../datos/platform";
import type { PlatformRefusal } from "../datos/platform-errors";
import {
  parseExtendDays,
  parsePaymentForm,
  parseVoidReason,
  type PaymentField,
  type PaymentFormCode,
  type VoidFormCode,
} from "../dominio/platform-forms";

// The platform panel (task 5.4). Only the super admin: every action checks
// the session first, and the database checks again in each function. The
// ids from the browser are checked before they reach a path.

const isId = (value: string) => z.uuid().safeParse(value).success;

function barbershopIdOf(formData: FormData): string {
  const id = String(formData.get("barberia") ?? "");
  // Never a path built from something that is not an id.
  if (!isId(id)) redirect(routes.admin);
  return id;
}

function backToBarbershop(id: string, notice: string): never {
  revalidatePath(routes.adminBarbershop(id));
  redirect(`${routes.adminBarbershop(id)}?hecho=${notice}`);
}

export type PaymentState = FormState<
  PaymentField,
  PaymentFormCode | PlatformRefusal
>;

// P-03: one month of the plan, then P-02 says so.
export async function registerPayment(
  _previous: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  await requireSuperAdmin();
  const id = barbershopIdOf(formData);
  const today = toBogotaDate(now());
  const form = readForm(formData, {
    fields: ["metodo", "referencia", "fecha"],
    parse: (input) => parsePaymentForm(input, today),
  });
  if (!form.valid) return form.state;

  const plan = await currentPlan();
  const result = await registerPaymentData({
    barbershopId: id,
    plan: plan.code,
    ...form.data,
  });
  if (!result.ok) {
    return { status: "failed", error: result.error, values: form.values };
  }
  backToBarbershop(id, "pago");
}

export type ConfirmState = FormState<
  "motivo" | "dias",
  PlatformRefusal | VoidFormCode
>;

// Decision P4: voiding a payment, with its reason.
export async function voidPayment(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  await requireSuperAdmin();
  const id = barbershopIdOf(formData);
  const paymentId = String(formData.get("pago") ?? "");
  const reason = parseVoidReason(String(formData.get("motivo") ?? ""));
  const values = { motivo: String(formData.get("motivo") ?? "") };
  if (!reason.success) {
    return { status: "invalid", fieldErrors: reason.errors, values };
  }
  if (!isId(paymentId)) return { status: "failed", error: "not_found", values };
  const result = await voidPaymentData(paymentId, reason.data);
  if (!result.ok) return { status: "failed", error: result.error, values };
  backToBarbershop(id, "anulado");
}

// P-05.
export async function suspendBarbershop(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  await requireSuperAdmin();
  const id = barbershopIdOf(formData);
  const result = await suspendData(id);
  if (!result.ok) return { status: "failed", error: result.error, values: {} };
  backToBarbershop(id, "suspendida");
}

// Decision P5: Reactivar, which never touches dates.
export async function reactivateBarbershop(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  await requireSuperAdmin();
  const id = barbershopIdOf(formData);
  const result = await reactivateData(id);
  if (!result.ok) return { status: "failed", error: result.error, values: {} };
  backToBarbershop(id, "reactivada");
}

// P-04: the trial, so many days further from its current end.
export async function extendTrial(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  await requireSuperAdmin();
  const id = barbershopIdOf(formData);
  const values = { dias: String(formData.get("dias") ?? "") };
  const days = parseExtendDays(values.dias);
  if (days === null) {
    return { status: "invalid", fieldErrors: { dias: "invalid" }, values };
  }
  const shop = await loadPlatformBarbershop(id, toBogotaDate(now()));
  if (!shop) return { status: "failed", error: "not_found", values };
  // From the end of the trial, or from today if it already ended, so the
  // new date is always ahead (decision P3).
  const today = toBogotaDate(now());
  const base = shop.trialEndsOn > today ? shop.trialEndsOn : today;
  const result = await extendTrialData(id, addDays(base, days));
  if (!result.ok) return { status: "failed", error: result.error, values };
  backToBarbershop(id, "extendida");
}
