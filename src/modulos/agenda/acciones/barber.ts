"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isBogotaDate, now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { barberAgendaHref, routes } from "@/lib/routes";
import { isLinkToken } from "@/lib/tokens/link-token";
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

// "Mi agenda" of a barber (task 4.4). Everything the browser sends is
// untrusted: the token, the ids, the day and the times are checked here and
// again in the database (migration add_barber_agenda), which also enforces
// what the barber may change.

const isId = (value: string) => z.uuid().safeParse(value).success;

// Where a mark or a removal sends the barber back: the appointment (B-03)
// or the day of B-01. A link that stopped working goes to the link, which
// then shows B-05. A refusal travels as ?aviso=, for the screen to explain.
function back(
  token: string,
  target: { appointmentId: string } | { date: string },
  refusal?: BarberRefusal,
): never {
  if (refusal === "link_invalid") redirect(routes.barberAgenda(token));
  if ("appointmentId" in target) {
    const path = routes.barberAppointment(token, target.appointmentId);
    redirect(refusal ? `${path}?aviso=${refusal}` : path);
  }
  const today = toBogotaDate(now());
  redirect(
    barberAgendaHref(token, {
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
export async function markAppointment(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  // Never a redirect built from something that is not a token.
  if (!isLinkToken(token)) redirect(routes.home);
  const appointmentId = String(formData.get("cita") ?? "");
  const status = String(formData.get("estado") ?? "");
  const target = returnTarget(formData, appointmentId);
  if (!isId(appointmentId) || (status !== "attended" && status !== "no_show")) {
    back(token, target, "not_yours");
  }
  const result = await markAppointmentByBarber(
    token,
    appointmentId,
    status as "attended" | "no_show",
  );
  back(token, target, result.ok ? undefined : result.error);
}

// "Quitar" on a block of B-01.
export async function removeBlock(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!isLinkToken(token)) redirect(routes.home);
  const blockId = String(formData.get("bloqueo") ?? "");
  const date = String(formData.get("volver") ?? "");
  const target = { date: isBogotaDate(date) ? date : toBogotaDate(now()) };
  if (!isId(blockId)) back(token, target, "not_yours");
  const result = await deleteTimeBlockByBarber(token, blockId);
  back(token, target, result.ok ? undefined : result.error);
}

export type BlockState = FormState<BlockField, BarberRefusal | BlockFormCode>;

// B-04: the block, then B-01 on its day.
export async function createBlock(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const token = String(formData.get("token") ?? "");
  if (!isLinkToken(token)) {
    return { status: "failed", error: "link_invalid", values: {} };
  }
  const instant = now();
  const form = readForm(formData, {
    fields: ["dia", "desde", "hasta", "motivo"],
    parse: (input) => parseBlockForm(input, toBogotaDate(instant), instant),
  });
  if (!form.valid) return form.state;

  const { start, end, reason } = form.data;
  const result = await createTimeBlockByBarber(token, {
    start,
    end,
    reason: reason === "other" ? null : textos.barbero.bloquear.motivos[reason],
  });
  if (result.ok) back(token, { date: form.values.dia ?? "" });
  if (result.error === "link_invalid") redirect(routes.barberAgenda(token));
  if (result.error === "too_early") {
    return {
      status: "invalid",
      fieldErrors: { desde: "in_the_past" },
      values: form.values,
    };
  }
  return { status: "failed", error: result.error, values: form.values };
}
