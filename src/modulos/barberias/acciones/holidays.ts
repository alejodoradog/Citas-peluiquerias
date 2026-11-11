"use server";

import { refreshPublicProfile } from "@/lib/cache-tags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { SAVED_PARAM, routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  deleteClosure,
  insertClosure,
  setHolidayOpenings,
} from "../datos/holidays";
import { barbershopNeedsSetup } from "../datos/setup";
import {
  parseClosureForm,
  type ClosureErrorCode,
  type ClosureField,
} from "../dominio/closures";
import { holidayWindow, parseHolidayOpenings } from "../dominio/holidays";
import { isId } from "../dominio/service";

// D-59, Festivos y cierres. Everything acts on the owner's barbershop:
// nothing the browser sends picks the barbershop.

// unknown: a holiday the screen could not have sent, or the database wrote
// nothing.
export type HolidaysState = FormState<"open", "unknown">;

async function requireReadyShop(): Promise<string> {
  const { barbershop } = await requireOwner();
  // The wizard sets the first hours; until it ends, it is the place to go.
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);
  return barbershop.id;
}

// "Guardar": the switches of the holidays of the next 12 months, each "open"
// field one date switched on. The rest of the window closes.
export async function saveHolidayOpenings(
  _previous: HolidaysState,
  formData: FormData,
): Promise<HolidaysState> {
  const barbershopId = await requireReadyShop();
  const window = holidayWindow(toBogotaDate(now()));
  const sent = parseHolidayOpenings(formData.getAll("open"), window);
  if (sent.status === "malformed") {
    return { status: "failed", error: "unknown", values: {} };
  }
  if (!(await setHolidayOpenings(barbershopId, window, sent.dates))) {
    return { status: "failed", error: "unknown", values: {} };
  }
  refreshPublicProfile(barbershopId);
  revalidatePath(routes.panelHolidays);
  redirect(`${routes.panelHolidays}?${SAVED_PARAM}=1`);
}

// - closure_*: what is wrong with the closure (dominio/closures.ts).
// - unknown: the database wrote nothing.
export type ClosureActionErrorCode = ClosureErrorCode | "unknown";

export type ClosureState = FormState<
  ClosureField,
  ClosureActionErrorCode,
  "closure_added"
>;

const CLOSURE_FIELDS = [
  "fromDate",
  "toDate",
  "allDay",
  "fromTime",
  "toTime",
  "reason",
] as const;

// "Agregar cierre": a closure of the whole barbershop, saved at once.
export async function addClosure(
  _previous: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  const barbershopId = await requireReadyShop();
  const form = readForm(formData, {
    fields: CLOSURE_FIELDS,
    parse: (input) => parseClosureForm(input, now()),
  });
  if (!form.valid) return form.state;

  if (!(await insertClosure(barbershopId, form.data))) {
    return { status: "failed", error: "unknown", values: form.values };
  }
  refreshPublicProfile(barbershopId);
  revalidatePath(routes.panelHolidays);
  return { status: "done", notice: "closure_added" };
}

export type ClosureCommandResult =
  { ok: true } | { ok: false; error: "unknown" };

// The trash button of a closure, after its confirmation. Only closures of the
// whole barbershop; a barber's blocks stay.
export async function removeClosure(
  closureId: string,
): Promise<ClosureCommandResult> {
  const barbershopId = await requireReadyShop();
  if (!isId(closureId)) return { ok: false, error: "unknown" };
  if (!(await deleteClosure(barbershopId, closureId))) {
    return { ok: false, error: "unknown" };
  }
  refreshPublicProfile(barbershopId);
  revalidatePath(routes.panelHolidays);
  return { ok: true };
}
