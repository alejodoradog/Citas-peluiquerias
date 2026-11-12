"use server";

import { redirect } from "next/navigation";
import { fromBogota, isBogotaDate } from "@/lib/fechas/fechas";
import type { FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import {
  cancelManagedAppointment,
  rescheduleManagedAppointment,
} from "../datos/manage-appointment";
import type { ManageRefusal } from "../datos/manage-errors";
import { manageQuery } from "../dominio/manage-flow";

// "Gestionar mi cita" (task 3.4). Everything the browser sends is untrusted:
// the token, the day and the time are checked here and again in the
// database (migration add_manage_appointment), which also enforces the
// policy's hours.

// done: cancelled, so the screen shows C-12.
export type CancelState = FormState<never, ManageRefusal>;

const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

// C-11 → C-12. A link that stopped working or a time inside the policy's
// hours sends the customer back to the link, which then shows C-16 or C-13.
export async function cancelAppointment(
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get("token") ?? "");
  const result = await cancelManagedAppointment(token);
  if (result.ok) return { status: "done" };
  if (result.error === "link_invalid" || result.error === "too_late") {
    redirect(routes.manageAppointment(token));
  }
  return { status: "failed", error: result.error, values: {} };
}

export type RescheduleState = FormState<never, ManageRefusal>;

// C-10, "Cambiar mi cita": the same appointment to the chosen time, then
// C-09 says it moved. A time taken in the meantime goes back to C-10 saying
// so, like C-07 in the booking.
export async function rescheduleAppointment(
  _previous: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const token = String(formData.get("token") ?? "");
  const date = String(formData.get("dia") ?? "");
  const time = String(formData.get("hora") ?? "");
  if (!isBogotaDate(date) || !QUARTER_TIME.test(time)) {
    return { status: "failed", error: "slot_gone", values: {} };
  }

  const result = await rescheduleManagedAppointment(
    token,
    fromBogota(date, time),
  );
  const back = routes.manageAppointment(token);
  if (result.ok) redirect(back + manageQuery({ changed: true }));
  if (result.error === "link_invalid" || result.error === "too_late") {
    redirect(back);
  }
  if (result.error === "slot_gone") {
    redirect(back + manageQuery({ step: "cambiar", date, taken: time }));
  }
  return { status: "failed", error: result.error, values: {} };
}
