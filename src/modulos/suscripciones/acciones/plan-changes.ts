"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addDays, now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireOwner, requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  acceptPlanChange as acceptData,
  cancelPlanChange as cancelData,
  listPlanChanges,
  rejectPlanChange as rejectData,
  requestPlanChange as requestData,
  voidPlanChange as voidData,
  type OwnerPlanRefusal,
} from "../datos/plan-changes";
import type { PlatformRefusal } from "../datos/platform-errors";
import {
  earliestPaymentDay,
  parsePaymentForm,
  parseVoidReason,
  PAYMENT_DAYS_BACK,
  type PaymentField,
  type PaymentFormCode,
  type VoidFormCode,
} from "../dominio/platform-forms";

// "Cambiar plan" (task 7.8b). The owner asks for their own establishment,
// never one named by the form; the super admin decides. The database checks
// both again.

const isId = (value: unknown): value is string =>
  typeof value === "string" && z.uuid().safeParse(value).success;

export type OwnerPlanState = FormState<never, OwnerPlanRefusal>;

function backToPlan(notice: string): never {
  revalidatePath(routes.panelPlan);
  revalidatePath(routes.panelMore);
  redirect(`${routes.panelPlan}?hecho=${notice}`);
}

// Only up, to plan 2 (provisional decision 6).
export async function requestPlanUpgrade(): Promise<OwnerPlanState> {
  const { barbershop } = await requireOwner();
  const result = await requestData(barbershop.id, "plus");
  if (!result.ok) return { status: "failed", error: result.error, values: {} };
  backToPlan("solicitud");
}

export async function cancelPlanUpgrade(
  _previous: OwnerPlanState,
  formData: FormData,
): Promise<OwnerPlanState> {
  await requireOwner();
  const id = formData.get("solicitud");
  if (!isId(id)) return { status: "failed", error: "not_found", values: {} };
  const result = await cancelData(id);
  if (!result.ok) return { status: "failed", error: result.error, values: {} };
  backToPlan("cancelada");
}

export type AcceptPlanState = FormState<
  PaymentField,
  PaymentFormCode | PlatformRefusal
>;

function backToRequests(notice: string): never {
  revalidatePath(routes.adminPlanChanges);
  redirect(`${routes.adminPlanChanges}?hecho=${notice}`);
}

// Accepting is registering the payment of the difference: the method, the
// reference, the day, and the value the sheet showed (price_changed).
export async function acceptPlanChange(
  _previous: AcceptPlanState,
  formData: FormData,
): Promise<AcceptPlanState> {
  await requireSuperAdmin();
  const id = formData.get("solicitud");
  const today = toBogotaDate(now());
  const pending = isId(id)
    ? (await listPlanChanges({ pendingOnly: true })).find(
        (request) => request.id === id,
      )
    : undefined;
  // Never a day before the request (the database checks it again).
  const form = readForm(formData, {
    fields: ["metodo", "referencia", "fecha"],
    parse: (input) =>
      parsePaymentForm(
        input,
        today,
        pending
          ? earliestPaymentDay(today, toBogotaDate(pending.requestedAt))
          : addDays(today, -PAYMENT_DAYS_BACK),
      ),
  });
  if (!form.valid) return form.state;
  if (!isId(id) || !pending) {
    return { status: "failed", error: "not_found", values: form.values };
  }
  const shown = Number(formData.get("valor"));
  if (shown !== pending.amountCop) {
    return { status: "failed", error: "plan_changed", values: form.values };
  }
  const result = await acceptData({
    requestId: id,
    ...form.data,
    amountCop: shown,
  });
  if (!result.ok) {
    return { status: "failed", error: result.error, values: form.values };
  }
  revalidatePath(routes.adminBarbershop(pending.barbershopId));
  backToRequests("aceptada");
}

export type DecidePlanState = FormState<
  "motivo",
  PlatformRefusal | VoidFormCode
>;

export async function rejectPlanChange(
  _previous: DecidePlanState,
  formData: FormData,
): Promise<DecidePlanState> {
  await requireSuperAdmin();
  const id = formData.get("solicitud");
  const values = { motivo: String(formData.get("motivo") ?? "") };
  const reason = parseVoidReason(values.motivo);
  if (!reason.success) {
    return { status: "invalid", fieldErrors: reason.errors, values };
  }
  if (!isId(id)) return { status: "failed", error: "not_found", values };
  const result = await rejectData(id, reason.data);
  if (!result.ok) return { status: "failed", error: result.error, values };
  backToRequests("rechazada");
}

// From the ficha (P-02): voiding the payment of the difference takes the
// establishment back to its plan.
export async function voidPlanChange(
  _previous: DecidePlanState,
  formData: FormData,
): Promise<DecidePlanState> {
  await requireSuperAdmin();
  const id = formData.get("solicitud");
  const shop = formData.get("barberia");
  const values = { motivo: String(formData.get("motivo") ?? "") };
  const reason = parseVoidReason(values.motivo);
  if (!reason.success) {
    return { status: "invalid", fieldErrors: reason.errors, values };
  }
  if (!isId(id) || !isId(shop)) {
    return { status: "failed", error: "not_found", values };
  }
  const result = await voidData(id, reason.data);
  if (!result.ok) return { status: "failed", error: result.error, values };
  revalidatePath(routes.adminBarbershop(shop));
  redirect(`${routes.adminBarbershop(shop)}?hecho=cambioAnulado`);
}
