import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isBogotaDate, now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import type { BarberAgendaParams } from "@/lib/routes";
// The reason is saved in Spanish, because the owner's agenda shows it as it
// is (task 4.1). The only place a module reads src/ui.
import { textos } from "@/ui/textos";
import {
  createTimeBlockByBarber,
  deleteTimeBlockByBarber,
  markAppointmentByBarber,
  type BarberSource,
} from "../datos/barber-agenda";
import type { BarberRefusal } from "../datos/barber-errors";
import {
  parseBlockForm,
  type BlockField,
  type BlockFormCode,
} from "../dominio/barber-agenda";

// What "Mi agenda" does, whichever its entry (the private link of task 4.4
// or the professional's session of task 7.6b): the actions of ./barber.ts
// and ./my-agenda.ts only say who asks and where the screens are. Everything
// the browser sends is untrusted: the ids, the day and the times are checked
// here and again in the database, which also decides what the professional
// may change. No barber or barbershop id is ever read from the form.

export type AgendaPaths = {
  agenda: (query?: BarberAgendaParams) => string;
  appointment: (id: string) => string;
};

export type BlockState = FormState<BlockField, BarberRefusal | BlockFormCode>;

const isId = (value: string) => z.uuid().safeParse(value).success;

// The entry no longer works: a link that stopped working (B-05), or a
// session that is no longer of a professional. Its agenda says what to do.
const isGone = (refusal: BarberRefusal | undefined) =>
  refusal === "link_invalid" || refusal === "not_professional";

// Where a mark or a removal sends the professional back: the appointment
// (B-03) or the day of B-01. A refusal travels as ?aviso=, for the screen to
// explain.
function back(
  paths: AgendaPaths,
  target: { appointmentId: string } | { date: string },
  refusal?: BarberRefusal,
): never {
  if (isGone(refusal)) redirect(paths.agenda());
  if ("appointmentId" in target) {
    const path = paths.appointment(target.appointmentId);
    redirect(refusal ? `${path}?aviso=${refusal}` : path);
  }
  const today = toBogotaDate(now());
  redirect(
    paths.agenda({
      dia: target.date !== today ? target.date : undefined,
      aviso: refusal,
    }),
  );
}

function returnTarget(
  formData: FormData,
  appointmentId: string,
): { appointmentId: string } | { date: string } {
  const to = String(formData.get("volver") ?? "");
  if (to === "cita") return { appointmentId };
  return { date: isBogotaDate(to) ? to : toBogotaDate(now()) };
}

// "Atendida" and "No asistió" on B-01 and B-03.
export async function markFor(
  source: BarberSource,
  paths: AgendaPaths,
  formData: FormData,
): Promise<never> {
  const appointmentId = String(formData.get("cita") ?? "");
  const status = String(formData.get("estado") ?? "");
  // Only a real id goes into a path; anything else goes back to today.
  const target = isId(appointmentId)
    ? returnTarget(formData, appointmentId)
    : { date: toBogotaDate(now()) };
  if (!isId(appointmentId) || (status !== "attended" && status !== "no_show")) {
    back(paths, target, "not_yours");
  }
  const result = await markAppointmentByBarber(
    source,
    appointmentId,
    status as "attended" | "no_show",
  );
  back(paths, target, result.ok ? undefined : result.error);
}

// "Quitar" on a block of B-01.
export async function removeBlockFor(
  source: BarberSource,
  paths: AgendaPaths,
  formData: FormData,
): Promise<never> {
  const blockId = String(formData.get("bloqueo") ?? "");
  const date = String(formData.get("volver") ?? "");
  const target = { date: isBogotaDate(date) ? date : toBogotaDate(now()) };
  if (!isId(blockId)) back(paths, target, "not_yours");
  const result = await deleteTimeBlockByBarber(source, blockId);
  back(paths, target, result.ok ? undefined : result.error);
}

// B-04: the block, then B-01 on its day.
export async function createBlockFor(
  source: BarberSource,
  paths: AgendaPaths,
  formData: FormData,
): Promise<BlockState> {
  const instant = now();
  const form = readForm(formData, {
    fields: ["dia", "desde", "hasta", "motivo", "todoElDia"],
    parse: (input) => parseBlockForm(input, toBogotaDate(instant), instant),
  });
  if (!form.valid) return form.state;

  const { start, end, reason } = form.data;
  const result = await createTimeBlockByBarber(source, {
    start,
    end,
    reason: reason === "other" ? null : textos.barbero.bloquear.motivos[reason],
  });
  if (result.ok) back(paths, { date: form.values.dia ?? "" });
  if (isGone(result.error)) redirect(paths.agenda());
  if (result.error === "too_early") {
    return {
      status: "invalid",
      fieldErrors: { desde: "in_the_past" },
      values: form.values,
    };
  }
  return { status: "failed", error: result.error, values: form.values };
}
