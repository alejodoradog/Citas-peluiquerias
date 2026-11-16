"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isBogotaDate, now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { myAgendaHref, routes } from "@/lib/routes";
import { requireProfessional } from "@/modulos/cuentas/guards";
// The reason is saved in Spanish, because the owner's agenda shows it as it
// is (task 4.1). The only place a module reads src/ui.
import { textos } from "@/ui/textos";
import {
  createTimeBlockByBarber,
  deleteTimeBlockByBarber,
  markAppointmentByBarber,
} from "../datos/barber-agenda";
import type { BarberRefusal } from "../datos/barber-errors";
import {
  parseBlockForm,
  type BlockField,
  type BlockFormCode,
} from "../dominio/barber-agenda";

// "Mi agenda" of a professional with their own account (tasks 4.4 and 7.6b;
// the private link went with task 7.6c). Who asks is the session in the
// request's cookies, and nothing else: the form carries no token, no barber
// and no barbershop, and the my_* functions find the professional from
// auth.uid() (migration add_professional_accounts). Each action first passes
// the same guard as the pages (requireProfessional: a professional who
// accepted the terms; anyone else goes home), and the database checks it
// again (private.barber_by_session needs the terms too). Everything the
// browser sends is untrusted: the ids, the day and the times are checked
// here and again in the database, which also decides what the professional
// may change.

export type BlockState = FormState<BlockField, BarberRefusal | BlockFormCode>;

const isId = (value: string) => z.uuid().safeParse(value).success;

// Where a mark or a removal sends the professional back: the appointment
// (B-03) or the day of B-01. A refusal travels as ?aviso=, for the screen to
// explain. A session that is no longer of a professional goes to its agenda,
// whose guard sends it home.
function back(
  target: { appointmentId: string } | { date: string },
  refusal?: BarberRefusal,
): never {
  if (refusal === "not_professional") redirect(routes.myAgenda);
  if ("appointmentId" in target) {
    const path = routes.myAppointment(target.appointmentId);
    redirect(refusal ? `${path}?aviso=${refusal}` : path);
  }
  const today = toBogotaDate(now());
  redirect(
    myAgendaHref({
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
export async function markMyAppointment(formData: FormData): Promise<void> {
  await requireProfessional();
  const appointmentId = String(formData.get("cita") ?? "");
  const status = String(formData.get("estado") ?? "");
  // Only a real id goes into a path; anything else goes back to today.
  const target = isId(appointmentId)
    ? returnTarget(formData, appointmentId)
    : { date: toBogotaDate(now()) };
  if (!isId(appointmentId) || (status !== "attended" && status !== "no_show")) {
    back(target, "not_yours");
  }
  const result = await markAppointmentByBarber(
    appointmentId,
    status as "attended" | "no_show",
  );
  back(target, result.ok ? undefined : result.error);
}

// "Quitar" on a block of B-01.
export async function removeMyBlock(formData: FormData): Promise<void> {
  await requireProfessional();
  const blockId = String(formData.get("bloqueo") ?? "");
  const date = String(formData.get("volver") ?? "");
  const target = { date: isBogotaDate(date) ? date : toBogotaDate(now()) };
  if (!isId(blockId)) back(target, "not_yours");
  const result = await deleteTimeBlockByBarber(blockId);
  back(target, result.ok ? undefined : result.error);
}

// B-04: the block, then B-01 on its day.
export async function createMyBlock(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  await requireProfessional();
  const instant = now();
  const form = readForm(formData, {
    fields: ["dia", "desde", "hasta", "motivo", "todoElDia"],
    parse: (input) => parseBlockForm(input, toBogotaDate(instant), instant),
  });
  if (!form.valid) return form.state;

  const { start, end, reason } = form.data;
  const result = await createTimeBlockByBarber({
    start,
    end,
    reason: reason === "other" ? null : textos.barbero.bloquear.motivos[reason],
  });
  if (result.ok) back({ date: form.values.dia ?? "" });
  if (result.error === "not_professional") redirect(routes.myAgenda);
  if (result.error === "too_early") {
    return {
      status: "invalid",
      fieldErrors: { desde: "in_the_past" },
      values: form.values,
    };
  }
  return { status: "failed", error: result.error, values: form.values };
}
