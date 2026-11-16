"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agendaHref, routes } from "@/lib/routes";
import { requireOwner, requireProfessional } from "@/modulos/cuentas/guards";
import {
  createMyWalkIn,
  createOwnerWalkIn,
  type WalkInResult,
} from "../datos/walk-in";
import type { WalkInRefusal } from "../datos/walk-in-errors";
import {
  parseWalkInBarber,
  parseWalkInForm,
  type WalkInClash,
  type WalkInField,
  type WalkInFormCode,
} from "../dominio/walk-in";

// Task 7.7: "Cita al momento", for a customer who arrives without a booking.
// Everything the browser sends is untrusted: the services and the name are
// checked here and again by the database, which also sets the start (now)
// and decides whether it fits (decision D5: a clash is refused, never
// forced). The professional's action sends no professional nor
// establishment: the session is who. The owner's sends the professional,
// and the establishment is the owner's active one (requireOwner); the
// database checks that the professional is of it.

type StateField = WalkInField | "servicios";
type StateCode = WalkInRefusal | WalkInFormCode;

export type WalkInState =
  | { status: "idle" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<string, StateCode | "invalid">>;
      values: Partial<Record<StateField, string>>;
    }
  | {
      status: "failed";
      error: StateCode;
      values: Partial<Record<StateField, string>>;
      // Why it does not fit, for the screen to say with what and how much
      // time is free.
      clash: WalkInClash | null;
    }
  | { status: "done" };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// A refusal back to the screen: the name and the professional as a field
// error, the rest above the form.
function refused(
  result: Extract<WalkInResult, { ok: false }>,
  values: Partial<Record<StateField, string>>,
): WalkInState {
  const field = (
    {
      customer_name_invalid: "nombre",
      barber_not_found: "profesional",
    } as Partial<Record<WalkInRefusal, StateField>>
  )[result.error];
  if (field) {
    return {
      status: "invalid",
      fieldErrors: { [field]: result.error },
      values,
    };
  }
  return { status: "failed", error: result.error, values, clash: result.clash };
}

// The professional, from "Mi agenda": then back to it, with the appointment
// in it.
export async function createMyWalkInAction(
  _previous: WalkInState,
  formData: FormData,
): Promise<WalkInState> {
  await requireProfessional();
  const values = { nombre: text(formData, "nombre") };
  const form = parseWalkInForm({
    servicios: formData.getAll("servicios"),
    nombre: formData.get("nombre"),
  });
  if (!form.success) {
    return { status: "invalid", fieldErrors: form.errors, values };
  }
  const result = await createMyWalkIn(form.data);
  if (result.ok) redirect(routes.myAgenda);
  // A session that is no longer of a professional: its agenda sends it home.
  if (result.error === "not_professional") redirect(routes.myAgenda);
  return refused(result, values);
}

// The owner, from the agenda: then the agenda of today.
export async function createOwnerWalkInAction(
  _previous: WalkInState,
  formData: FormData,
): Promise<WalkInState> {
  const { barbershop } = await requireOwner();
  if (barbershop.needsSetup) redirect(routes.setup);
  const values = {
    nombre: text(formData, "nombre"),
    profesional: text(formData, "profesional"),
  };
  const barber = parseWalkInBarber(formData.get("profesional"));
  const form = parseWalkInForm({
    servicios: formData.getAll("servicios"),
    nombre: formData.get("nombre"),
  });
  if (!barber.success || !form.success) {
    return {
      status: "invalid",
      fieldErrors: {
        ...(barber.success ? {} : barber.errors),
        ...(form.success ? {} : form.errors),
      },
      values,
    };
  }
  const result = await createOwnerWalkIn(barbershop.id, barber.data, form.data);
  if (result.ok) {
    revalidatePath(routes.panel);
    redirect(agendaHref());
  }
  return refused(result, values);
}
