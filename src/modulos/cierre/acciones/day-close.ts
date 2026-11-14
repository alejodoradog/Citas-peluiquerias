"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { saveCommission } from "../datos/day-close";
import { parseCloseDay, parseCommission } from "../dominio/day-close";

// "Comisión de los barberos" on D-64 (task 4.6, decision C1): one percentage
// for the active barbershop. It always goes back to the day it came from;
// ?guardado=1 or ?aviso=1 says how it went.
export async function setCommission(formData: FormData): Promise<void> {
  const { barbershop } = await requireOwner();
  const date = parseCloseDay(
    String(formData.get("dia") ?? ""),
    toBogotaDate(now()),
  );
  const percent = parseCommission(String(formData.get("comision") ?? ""));
  const saved =
    percent !== null && (await saveCommission(barbershop.id, percent));
  revalidatePath(routes.panelClose);
  const params = new URLSearchParams({ dia: date });
  params.set(saved ? "guardado" : "aviso", "1");
  redirect(`${routes.panelClose}?${params.toString()}`);
}
