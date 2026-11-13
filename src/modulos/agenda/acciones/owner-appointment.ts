"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { agendaHref, routes } from "@/lib/routes";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import { isId } from "@/modulos/barberias/dominio/service";
import { requireOwner } from "@/modulos/cuentas/guards";
import { textos } from "@/ui/textos";
import {
  changeOwnerAppointmentServices,
  createManualAppointment,
  createOwnerBlock,
  deleteOwnerBlock,
  findCustomers,
  rescheduleOwnerAppointment,
  setOwnerAppointmentStatus,
  type CustomerMatch,
} from "../datos/owner-appointment";
import type { OwnerRefusal } from "../datos/owner-appointment-errors";
import {
  parseBlockForm,
  type BlockField,
  type BlockFormCode,
} from "../dominio/barber-agenda";
import {
  parseManualCustomer,
  parseServiceIds,
  parseSlot,
  type CustomerField,
  type SlotField,
} from "../dominio/owner-forms";
import { DONE_PARAM, type DoneCode } from "../dominio/owner-slots";

// Task 4.2: what the owner does from D-34 to D-39. They act on the owner's
// ACTIVE barbershop as the server knows it; the browser sends ids, a day and
// times, which are checked here and again by the database (migration
// add_owner_appointment_actions), which also keeps them inside the owner's
// barbershops.

async function readyBarbershop() {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);
  return barbershop;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function appointmentId(formData: FormData): string | null {
  const id = text(formData, "cita");
  return isId(id) ? id : null;
}

// Back to D-34, which says what changed.
function backToAppointment(id: string, done: DoneCode): never {
  revalidatePath(routes.panel);
  redirect(`${routes.panelAppointment(id)}?${DONE_PARAM}=${done}`);
}

export type AppointmentState = FormState<never, OwnerRefusal>;

// D-35: attended or no-show.
export async function markAppointment(
  _previous: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  await readyBarbershop();
  const id = appointmentId(formData);
  const status = text(formData, "estado");
  if (!id) return { status: "failed", error: "not_found", values: {} };
  if (status !== "attended" && status !== "no_show") {
    return { status: "failed", error: "status_invalid", values: {} };
  }
  const result = await setOwnerAppointmentStatus(id, status);
  if (result.ok) backToAppointment(id, status);
  return { status: "failed", error: result.error, values: {} };
}

// D-36: the barbershop cancels.
export async function cancelOwnerAppointment(
  _previous: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  await readyBarbershop();
  const id = appointmentId(formData);
  if (!id) return { status: "failed", error: "not_found", values: {} };
  const result = await setOwnerAppointmentStatus(id, "cancelled_by_barbershop");
  if (result.ok) backToAppointment(id, "cancelled");
  return { status: "failed", error: result.error, values: {} };
}

// The pencil of D-34: the services of the appointment.
export async function changeAppointmentServices(
  _previous: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  await readyBarbershop();
  const id = appointmentId(formData);
  if (!id) return { status: "failed", error: "not_found", values: {} };
  const serviceIds = parseServiceIds(formData.getAll("servicios"));
  if (!serviceIds) {
    return { status: "failed", error: "services_required", values: {} };
  }
  const result = await changeOwnerAppointmentServices(id, serviceIds);
  if (result.ok) backToAppointment(id, "services");
  return { status: "failed", error: result.error, values: {} };
}

export type SlotState = FormState<SlotField, OwnerRefusal>;

// D-37: another barber, day or time; the same services and length.
export async function rescheduleOwnerAppointmentAction(
  _previous: SlotState,
  formData: FormData,
): Promise<SlotState> {
  await readyBarbershop();
  const id = appointmentId(formData);
  if (!id) return { status: "failed", error: "not_found", values: {} };
  const form = readForm(formData, {
    fields: ["barbero", "dia", "hora"],
    parse: parseSlot,
  });
  if (!form.valid) return form.state;
  const result = await rescheduleOwnerAppointment(
    id,
    form.data.barberId,
    form.data.start,
  );
  if (result.ok) backToAppointment(id, "rescheduled");
  return { status: "failed", error: result.error, values: form.values };
}

export type NewAppointmentState = FormState<
  SlotField | CustomerField,
  OwnerRefusal
>;

// D-38: a manual appointment, then its D-34.
export async function createOwnerAppointment(
  _previous: NewAppointmentState,
  formData: FormData,
): Promise<NewAppointmentState> {
  const barbershop = await readyBarbershop();
  const slot = readForm(formData, {
    fields: ["barbero", "dia", "hora"],
    parse: parseSlot,
  });
  const customer = readForm(formData, {
    fields: ["cliente", "nombre", "correo"],
    parse: parseManualCustomer,
  });
  const values = {
    ...(slot.valid
      ? slot.values
      : slot.state.status === "invalid"
        ? slot.state.values
        : {}),
    ...(customer.valid
      ? customer.values
      : customer.state.status === "invalid"
        ? customer.state.values
        : {}),
  };
  if (!slot.valid || !customer.valid) {
    return {
      status: "invalid",
      fieldErrors: {
        ...(slot.valid || slot.state.status !== "invalid"
          ? {}
          : slot.state.fieldErrors),
        ...(customer.valid || customer.state.status !== "invalid"
          ? {}
          : customer.state.fieldErrors),
      },
      values,
    };
  }
  const serviceIds = parseServiceIds(formData.getAll("servicios"));
  if (!serviceIds) {
    return { status: "failed", error: "services_required", values };
  }
  const result = await createManualAppointment(barbershop.id, {
    barberId: slot.data.barberId,
    start: slot.data.start,
    serviceIds,
    customer: customer.data,
  });
  if (result.ok) backToAppointment(result.value, "created");
  const field = (
    {
      customer_name_invalid: "nombre",
      customer_email_invalid: "correo",
    } as Partial<Record<OwnerRefusal, string>>
  )[result.error];
  if (field) {
    return {
      status: "invalid",
      fieldErrors: { [field]: result.error },
      values,
    };
  }
  return { status: "failed", error: result.error, values };
}

// D-38: the customers that match what the owner types (at most 5).
export async function searchCustomers(
  search: unknown,
): Promise<CustomerMatch[]> {
  const barbershop = await readyBarbershop();
  // Anyone can call a server action with anything: only text is searched.
  if (typeof search !== "string") return [];
  const query = search.trim().slice(0, 100);
  if (query.length < 2) return [];
  return findCustomers(barbershop.id, query);
}

export type BlockState = FormState<
  BlockField | "quien",
  OwnerRefusal | BlockFormCode
>;

// D-39: one barber or the whole barbershop, then the agenda of that day.
export async function createOwnerBlockAction(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const barbershop = await readyBarbershop();
  const who = text(formData, "quien");
  const barberId = who === "" ? null : who;
  if (barberId !== null && !isId(barberId)) {
    return {
      status: "invalid",
      fieldErrors: { quien: "barber_not_found" },
      values: { quien: "" },
    };
  }
  const instant = now();
  const form = readForm(formData, {
    fields: ["dia", "desde", "hasta", "motivo"],
    parse: (input) => parseBlockForm(input, toBogotaDate(instant), instant),
  });
  if (!form.valid) {
    return form.state.status === "invalid"
      ? { ...form.state, values: { ...form.state.values, quien: who } }
      : form.state;
  }
  const { start, end, reason } = form.data;
  const result = await createOwnerBlock(barbershop.id, {
    barberId,
    start,
    end,
    // As the barber's blocks (decision B9 of 4.4): the reason in Spanish,
    // "Otro" as none.
    reason: reason === "other" ? null : textos.barbero.bloquear.motivos[reason],
  });
  const values = { ...form.values, quien: who };
  if (result.ok) {
    revalidatePath(routes.panel);
    redirect(agendaHref({ dia: form.values.dia }));
  }
  if (result.error === "too_early") {
    return { status: "invalid", fieldErrors: { desde: "in_the_past" }, values };
  }
  return { status: "failed", error: result.error, values };
}

// The sheet of a block in the agenda: "Quitar bloqueo".
export async function removeOwnerBlock(
  _previous: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  await readyBarbershop();
  const id = text(formData, "bloqueo");
  if (!isId(id)) return { status: "failed", error: "not_found", values: {} };
  const result = await deleteOwnerBlock(id);
  if (!result.ok) return { status: "failed", error: result.error, values: {} };
  revalidatePath(routes.panel);
  return { status: "done" };
}
