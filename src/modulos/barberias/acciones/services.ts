"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  insertService,
  listServiceNames,
  setServiceBarbers,
  updateServiceRow,
} from "../datos/services";
import {
  isId,
  parseIdList,
  parseServiceForm,
  sameServiceName,
  type ServiceErrorCode,
} from "../dominio/service";

// - barbers_not_saved: the new service exists, but who does it could not be
//   saved (see createService).
export type ServiceActionErrorCode =
  ServiceErrorCode | "barbers_not_saved" | "unknown";

// barberIds and active are echoed too (ids joined by commas, "on" or ""), so
// the checkboxes and the switch keep what the owner chose when the form comes
// back with an error.
export type ServiceField =
  "name" | "price" | "duration" | "barberIds" | "active";

export type ServiceState = FormState<ServiceField, ServiceActionErrorCode>;

const TEXT_FIELDS = ["name", "price", "duration"] as const;

type ReadResult =
  | {
      ok: true;
      data: { name: string; price: number; duration: number };
      barberIds: string[];
      values: Partial<Record<ServiceField, string>>;
    }
  | { ok: false; state: ServiceState };

// Reads and checks the form of D-52. The name must not repeat any other
// service of the barbershop, active or not, whatever its case. Two owners
// saving the same name at the same instant could both pass; the database has
// no unique name to stop it, and the duplicate is fixed by renaming one.
async function readServiceForm(
  formData: FormData,
  barbershopId: string,
  editingId: string | null,
): Promise<ReadResult> {
  const choices = formData.getAll("barberIds");
  const echoed: Partial<Record<ServiceField, string>> = {
    barberIds: choices.filter((v) => typeof v === "string").join(","),
    active: formData.get("active") === "on" ? "on" : "",
  };

  const form = readForm(formData, {
    fields: TEXT_FIELDS,
    parse: parseServiceForm,
  });
  if (!form.valid) {
    const { state } = form;
    return {
      ok: false,
      state:
        state.status === "invalid"
          ? { ...state, values: { ...state.values, ...echoed } }
          : state,
    };
  }
  const values = { ...form.values, ...echoed };

  // The checkboxes only send ids; anything else did not come from the form.
  const barberIds = parseIdList(choices);
  if (!barberIds) {
    return { ok: false, state: { status: "failed", error: "unknown", values } };
  }

  const others = (await listServiceNames(barbershopId)).filter(
    (service) => service.id !== editingId,
  );
  if (others.some((service) => sameServiceName(service.name, form.data.name))) {
    return {
      ok: false,
      state: {
        status: "invalid",
        fieldErrors: { name: "service_name_taken" },
        values,
      },
    };
  }
  return { ok: true, data: form.data, barberIds, values };
}

function afterSave(): never {
  revalidatePath(routes.panelServices);
  revalidatePath(routes.panelMore);
  redirect(routes.panelServices);
}

// D-52, a new service. The barbershop is always the owner's own, never one
// named by the form.
export async function createService(
  _previous: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const { barbershop } = await requireOwner();
  const read = await readServiceForm(formData, barbershop.id, null);
  if (!read.ok) return read.state;

  const saved = await insertService(barbershop.id, {
    name: read.data.name,
    priceCop: read.data.price,
    durationMinutes: read.data.duration,
  });
  if (!saved.ok) {
    return saved.field
      ? {
          status: "invalid",
          fieldErrors: { [saved.field]: saved.code },
          values: read.values,
        }
      : { status: "failed", error: "unknown", values: read.values };
  }

  // Two steps, not one transaction: if this one fails, the service stays
  // created with nobody doing it. That is acceptable: nobody can book it until
  // someone does it, and the owner fixes it by opening it and saving again,
  // which the error says.
  if (!(await setServiceBarbers(saved.id, read.barberIds))) {
    revalidatePath(routes.panelServices);
    return {
      status: "failed",
      error: "barbers_not_saved",
      values: read.values,
    };
  }
  afterSave();
}

// D-52, an existing service. Its id comes from the form; RLS and the
// barbershop filter keep the update inside the owner's barbershop.
export async function updateService(
  _previous: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const { barbershop } = await requireOwner();
  const id = formData.get("serviceId");
  if (!isId(id)) {
    return { status: "failed", error: "unknown", values: {} };
  }
  const read = await readServiceForm(formData, barbershop.id, id);
  if (!read.ok) return read.state;

  const saved = await updateServiceRow(barbershop.id, id, {
    name: read.data.name,
    priceCop: read.data.price,
    durationMinutes: read.data.duration,
    active: read.values.active === "on",
  });
  if (!saved.ok) {
    return saved.field
      ? {
          status: "invalid",
          fieldErrors: { [saved.field]: saved.code },
          values: read.values,
        }
      : { status: "failed", error: "unknown", values: read.values };
  }
  if (!(await setServiceBarbers(id, read.barberIds))) {
    return { status: "failed", error: "unknown", values: read.values };
  }
  afterSave();
}
