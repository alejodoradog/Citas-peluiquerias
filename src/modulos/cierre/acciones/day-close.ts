"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes, SAVED_PARAM } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { loadSubscriptionNotice } from "@/modulos/suscripciones/datos/notice";
import { saveCommission } from "../datos/day-close";
import {
  parseCloseDay,
  parseCommission,
  PAUSED_WARNING,
} from "../dominio/day-close";

// "Comisión de los barberos" on D-64 (task 4.6, decision C1): one percentage
// for the active barbershop. It always goes back to the day it came from;
// ?guardado=1, ?aviso=1 or ?aviso=pausada says how it went.
export async function setCommission(formData: FormData): Promise<void> {
  const { barbershop } = await requireOwner();
  // Like every screen of the panel: the setup wizard first (task 2.1).
  if (barbershop.needsSetup) redirect(routes.setup);
  const today = toBogotaDate(now());
  const date = parseCloseDay(String(formData.get("dia") ?? ""), today);
  const percent = parseCommission(String(formData.get("comision") ?? ""));
  const saved =
    percent !== null && (await saveCommission(barbershop.id, percent));
  // A paused barbershop changes nothing (task 5.5): the database refuses it
  // and the screen says why.
  const notice =
    !saved && percent !== null
      ? (await loadSubscriptionNotice(barbershop.id, today))?.notice
      : null;
  // A sede awaiting its first payment can be configured: not why.
  const paused = notice?.kind === "paused" && !notice.firstPayment;
  revalidatePath(routes.panelClose);
  const params = new URLSearchParams({ dia: date });
  if (saved) params.set(SAVED_PARAM, "1");
  else params.set("aviso", paused ? PAUSED_WARNING : "1");
  redirect(`${routes.panelClose}?${params.toString()}`);
}
