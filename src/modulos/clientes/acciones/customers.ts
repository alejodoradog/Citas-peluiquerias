"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  anonymizeCustomer,
  updateCustomerNotes,
  type DeleteCustomerError,
} from "../datos/customers";
import {
  DELETED_PARAM,
  parseCustomerNotes,
  type NotesErrorCode,
} from "../dominio/customers";

// Task 4.3. Both act on a customer of the owner's ACTIVE barbershop, as the
// server knows it: the browser sends only the customer's id, and RLS with
// the filter by barbershop keeps every other customer out.

export type NotesActionErrorCode = NotesErrorCode | "unknown";
export type NotesState = FormState<"notes", NotesActionErrorCode, "saved">;

// The copy is far shorter; a forged form could send anything.
const MAX_NOTES_ECHO = 2000;

async function readyBarbershop() {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);
  return barbershop;
}

function customerId(formData: FormData): string {
  const id = formData.get("customerId");
  return typeof id === "string" ? id : "";
}

// D-41, "Guardar notas".
export async function saveCustomerNotes(
  _previous: NotesState,
  formData: FormData,
): Promise<NotesState> {
  const barbershop = await readyBarbershop();
  const id = customerId(formData);
  const form = readForm(formData, {
    fields: ["notes"],
    parse: parseCustomerNotes,
  });
  if (!form.valid) {
    if (form.state.status !== "invalid") return form.state;
    return {
      ...form.state,
      values: { notes: form.state.values.notes?.slice(0, MAX_NOTES_ECHO) },
    };
  }
  if (!(await updateCustomerNotes(barbershop.id, id, form.data.notes))) {
    return {
      status: "failed",
      error: "unknown",
      values: { notes: form.values.notes?.slice(0, MAX_NOTES_ECHO) },
    };
  }
  revalidatePath(routes.panelClient(id));
  return { status: "done", notice: "saved" };
}

export type DeleteCustomerActionErrorCode = DeleteCustomerError;
export type DeleteCustomerState = FormState<
  never,
  DeleteCustomerActionErrorCode
>;

// D-42 "Borrar cliente": anonymizes the customer (Ley 1581) and goes back to
// the list, which says so.
export async function deleteCustomer(
  _previous: DeleteCustomerState,
  formData: FormData,
): Promise<DeleteCustomerState> {
  const barbershop = await readyBarbershop();
  const id = customerId(formData);
  const result = await anonymizeCustomer(barbershop.id, id);
  if (!result.ok) {
    return { status: "failed", error: result.code, values: {} };
  }
  revalidatePath(routes.panelClients);
  revalidatePath(routes.panelClient(id));
  redirect(`${routes.panelClients}?${DELETED_PARAM}=1`);
}
