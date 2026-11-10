"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formularios/form-state";
import { SAVED_PARAM, routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { barbershopNeedsSetup, setBarbershopHours } from "../datos/setup";
import {
  dayField,
  toRpcShifts,
  validateShopWeek,
  type DayField,
  type ShopDayErrorCode,
  type Weekday,
} from "../dominio/weekly-hours";
import { readWeek } from "./week-field";

// - hours_*: what is wrong with a day. hours_overlap also comes back as a
//   form error when the database refuses two shifts that overlap, should the
//   check here ever miss one. The barbershop has no hours to fit into, so
//   hours_outside_shop never applies.
// - hours_required: every day closed (decision P5 of task 2.4).
// - unknown: anything else, a week the screen could not have sent included.
export type ShopHoursActionErrorCode =
  ShopDayErrorCode | "hours_required" | "unknown";

export type ShopHoursField = "shifts" | DayField;

export type ShopHoursState = FormState<
  ShopHoursField,
  ShopHoursActionErrorCode
>;

// D-58, "Guardar horario". The week replaces the barbershop's whole, in the
// owner's barbershop only: nothing the browser sends picks the barbershop.
// Barbers' own hours are not cut (decision 8 of task 2.2); D-58 warns about
// those that go beyond the new week.
export async function saveShopHours(
  _previous: ShopHoursState,
  formData: FormData,
): Promise<ShopHoursState> {
  const { barbershop } = await requireOwner();
  // The wizard sets the first hours; until it ends, it is the place to do it.
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);

  const sent = formData.get("shifts");
  const values = { shifts: typeof sent === "string" ? sent : "" };

  const week = validateShopWeek(readWeek(sent));
  if (week.status === "malformed") {
    return { status: "failed", error: "unknown", values };
  }
  if (week.status === "closed") {
    return { status: "failed", error: "hours_required", values };
  }
  if (week.status === "invalid") {
    const entries = Object.entries(week.errors) as Array<
      [string, ShopDayErrorCode]
    >;
    return {
      status: "invalid",
      fieldErrors: Object.fromEntries(
        entries.map(([weekday, code]) => [
          dayField(Number(weekday) as Weekday),
          code,
        ]),
      ),
      values,
    };
  }

  const saved = await setBarbershopHours(
    barbershop.id,
    toRpcShifts(week.shifts),
  );
  if (saved !== "saved") {
    const error =
      saved === "overlap"
        ? "hours_overlap"
        : saved === "closed"
          ? "hours_required"
          : "unknown";
    return { status: "failed", error, values };
  }

  revalidatePath(routes.panelMore);
  revalidatePath(routes.panelShopHours);
  // The team and each barber's screens show the barbershop's hours.
  revalidatePath(routes.panelBarbers);
  revalidatePath("/panel/barberos/[id]", "page");
  revalidatePath("/panel/barberos/[id]/horario", "page");
  redirect(`${routes.panelShopHours}?${SAVED_PARAM}=1`);
}
