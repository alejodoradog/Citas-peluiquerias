import { isBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";
import type { SearchParams } from "./booking-flow";

// The screens of "Gestionar mi cita" (task 3.4) live in the query of
// /c/<token>, like the booking flow: "atrás" and reloading keep them.
// - no paso: C-09 (C-13 inside the policy's hours);
// - paso=cambiar: C-10, with the day and the time chosen so far;
// - cambiada=1: C-09 says the appointment moved;
// - tomada=HH:MM: C-10 says that time was taken in the meantime.

export type ManageStep = "cita" | "cambiar";

export type ManageSelection = {
  step: ManageStep;
  date: BogotaDate | null;
  time: string | null;
  changed: boolean;
  taken: string | null;
};

const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;

function one(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length === 1 ? value[0]! : null;
  return value;
}

function time(value: string | null): string | null {
  return value !== null && QUARTER_TIME.test(value) ? value : null;
}

export function readManageParams(params: SearchParams): ManageSelection {
  const step: ManageStep = one(params.paso) === "cambiar" ? "cambiar" : "cita";
  const dateParam = one(params.dia);
  const date =
    step === "cambiar" && dateParam !== null && isBogotaDate(dateParam)
      ? dateParam
      : null;
  return {
    step,
    date,
    time: date ? time(one(params.hora)) : null,
    changed: step === "cita" && one(params.cambiada) === "1",
    taken: step === "cambiar" ? time(one(params.tomada)) : null,
  };
}

export function manageQuery(selection: {
  step?: ManageStep;
  date?: BogotaDate | null;
  time?: string | null;
  changed?: boolean;
  taken?: string | null;
}): string {
  const query = new URLSearchParams();
  if (selection.step === "cambiar") query.set("paso", "cambiar");
  if (selection.date) query.set("dia", selection.date);
  if (selection.time) query.set("hora", selection.time);
  if (selection.changed) query.set("cambiada", "1");
  if (selection.taken) query.set("tomada", selection.taken);
  const text = query.toString();
  return text ? `?${text}` : "";
}
