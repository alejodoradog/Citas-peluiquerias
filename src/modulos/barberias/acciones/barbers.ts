"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import {
  isOwnImageKey,
  type ImageUploadTicket as UploadTicket,
} from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  clearBarberPhoto,
  getBarber,
  insertBarber,
  listActiveServiceOptions,
  photoInUse,
  setBarberActiveRow,
  setBarberServices,
  updateBarberRow,
  type BarberWriteResult,
} from "../datos/barbers";
import { imageExists, removeImages } from "../datos/images";
import {
  missingServices,
  parseTeamBarberForm,
  type TeamBarberErrorCode,
} from "../dominio/barber";
import { isId, parseIdList } from "../dominio/service";

// - photo_invalid: the photo sent is not an upload of this barbershop that
//   exists (it expired, or the request was tampered with); choose it again.
// - services_not_saved: the new barber exists, but what they do could not be
//   saved (see createBarber).
// - owner_cannot_deactivate: the owner's own barber stays active (D-54).
export type BarberActionErrorCode =
  | TeamBarberErrorCode
  | "photo_invalid"
  | "services_not_saved"
  | "owner_cannot_deactivate"
  | "unknown";

// serviceIds, emailNotifications and photoPath are echoed too, so the
// checkboxes, the switch and a photo already uploaded survive an error.
// photoPath comes back empty when the photo was refused or deleted.
export type BarberField =
  "displayName" | "email" | "emailNotifications" | "serviceIds" | "photoPath";

export type BarberState = FormState<BarberField, BarberActionErrorCode>;

// What the buttons outside the form get back (deactivate, bring back, remove
// the photo). On success they navigate or refresh instead.
export type BarberCommandResult =
  { ok: true } | { ok: false; error: BarberActionErrorCode };

// The upload itself is requested from ./images (requestImageUpload).
export type ImageUploadTicket = UploadTicket;

const TEXT_FIELDS = ["displayName", "email", "emailNotifications"] as const;

type Values = Partial<Record<BarberField, string>>;

type ReadResult =
  | {
      ok: true;
      data: {
        displayName: string;
        email: string | null;
        emailNotifications: boolean;
      };
      serviceIds: string[];
      // The new photo, or null to keep the one there is.
      photoPath: string | null;
      values: Values;
    }
  | { ok: false; state: BarberState };

// Reads and checks the form of D-54. A new photo must be an upload of this
// barbershop's barbers folder that really exists, and not the photo of
// another barber (replacing that one would delete theirs).
async function readBarberForm(
  formData: FormData,
  barbershopId: string,
  editing: { id: string; photoPath: string | null } | null,
): Promise<ReadResult> {
  const choices = formData.getAll("serviceIds");
  const sentPhoto = formData.get("photoPath");
  const photo =
    typeof sentPhoto === "string" && sentPhoto !== "" ? sentPhoto : null;
  const echoed: Values = {
    serviceIds: choices.filter((v) => typeof v === "string").join(","),
    emailNotifications: formData.get("emailNotifications") === "on" ? "on" : "",
    photoPath: photo ?? "",
  };

  const form = readForm(formData, {
    fields: TEXT_FIELDS,
    parse: parseTeamBarberForm,
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
  const serviceIds = parseIdList(choices);
  if (!serviceIds) {
    return { ok: false, state: { status: "failed", error: "unknown", values } };
  }
  const services = await listActiveServiceOptions(barbershopId);
  if (missingServices(serviceIds, services.length)) {
    return {
      ok: false,
      state: {
        status: "invalid",
        fieldErrors: { serviceIds: "barber_services_required" },
        values,
      },
    };
  }

  const newPhoto =
    photo !== null && photo !== editing?.photoPath ? photo : null;
  if (
    newPhoto !== null &&
    !(
      isOwnImageKey(newPhoto, barbershopId, "barbers") &&
      !(await photoInUse(barbershopId, newPhoto, editing?.id ?? null)) &&
      (await imageExists(newPhoto))
    )
  ) {
    return {
      ok: false,
      state: {
        status: "failed",
        error: "photo_invalid",
        values: { ...values, photoPath: "" },
      },
    };
  }
  return { ok: true, data: form.data, serviceIds, photoPath: newPhoto, values };
}

// A failed write: the new photo is deleted (no row points at it) and the
// form says which field to fix.
async function writeFailed(
  saved: Extract<BarberWriteResult, { ok: false }>,
  read: Extract<ReadResult, { ok: true }>,
): Promise<BarberState> {
  if (read.photoPath) await removeImages([read.photoPath]);
  const values = { ...read.values, photoPath: "" };
  if (saved.field === "photo" || saved.code === "photo_invalid") {
    return { status: "failed", error: "photo_invalid", values };
  }
  return saved.field
    ? {
        status: "invalid",
        fieldErrors: { [saved.field]: saved.code },
        values,
      }
    : { status: "failed", error: "unknown", values };
}

function revalidateTeam(barberId?: string) {
  revalidatePath(routes.panelBarbers);
  if (barberId) revalidatePath(routes.panelBarberEdit(barberId));
  revalidatePath(routes.panelMore);
  // The service editor lists the active barbers (D-52).
  revalidatePath(routes.panelServices, "layout");
}

function afterSave(barberId: string): never {
  revalidateTeam(barberId);
  redirect(routes.panelBarbers);
}

// D-54, a new barber. The barbershop is always the owner's own, never one
// named by the form.
export async function createBarber(
  _previous: BarberState,
  formData: FormData,
): Promise<BarberState> {
  const { barbershop } = await requireOwner();
  const read = await readBarberForm(formData, barbershop.id, null);
  if (!read.ok) return read.state;

  const saved = await insertBarber(barbershop.id, {
    ...read.data,
    photoPath: read.photoPath,
  });
  if (!saved.ok) return writeFailed(saved, read);

  // Two steps, not one transaction, as with services: if this one fails, the
  // barber exists doing nothing, nobody can book them, and the owner fixes it
  // by opening them and saving again, which the error says.
  if (!(await setBarberServices(saved.id, read.serviceIds))) {
    revalidateTeam(saved.id);
    return {
      status: "failed",
      error: "services_not_saved",
      values: { ...read.values, photoPath: "" },
    };
  }
  afterSave(saved.id);
}

// D-54, an existing barber. Its id comes from the form; RLS and the
// barbershop filter keep the update inside the owner's barbershop. A new
// photo replaces the old one, which is deleted once nothing points at it.
export async function updateBarber(
  _previous: BarberState,
  formData: FormData,
): Promise<BarberState> {
  const { barbershop } = await requireOwner();
  const id = formData.get("barberId");
  const current = isId(id) ? await getBarber(barbershop.id, id) : null;
  if (!current) {
    return { status: "failed", error: "unknown", values: {} };
  }
  const read = await readBarberForm(formData, barbershop.id, {
    id: current.id,
    photoPath: current.photo_path,
  });
  if (!read.ok) return read.state;

  const saved = await updateBarberRow(barbershop.id, current.id, {
    ...read.data,
    ...(read.photoPath ? { photoPath: read.photoPath } : {}),
  });
  if (!saved.ok) return writeFailed(saved, read);
  if (read.photoPath && current.photo_path) {
    await removeImages([current.photo_path]);
  }

  if (!(await setBarberServices(current.id, read.serviceIds))) {
    revalidateTeam(current.id);
    return {
      status: "failed",
      error: "unknown",
      values: { ...read.values, photoPath: "" },
    };
  }
  afterSave(current.id);
}

// D-54, "Desactivar a …" (after its confirmation) and "Volver a activar a …".
// Deactivating keeps the barber's appointments and link (decision 6). The
// owner's own barber is not deactivated from here.
export async function setBarberActive(
  barberId: string,
  active: boolean,
): Promise<BarberCommandResult> {
  const { barbershop } = await requireOwner();
  if (typeof active !== "boolean") return { ok: false, error: "unknown" };
  const barber = isId(barberId)
    ? await getBarber(barbershop.id, barberId)
    : null;
  if (!barber) return { ok: false, error: "unknown" };
  if (barber.is_owner && !active) {
    return { ok: false, error: "owner_cannot_deactivate" };
  }
  if (!(await setBarberActiveRow(barbershop.id, barber.id, active))) {
    return { ok: false, error: "unknown" };
  }
  afterSave(barber.id);
}

// D-54, "Quitar foto": right away, so a barber who asks for their photo to be
// deleted (Ley 1581) does not depend on anything else being saved.
export async function removeBarberPhoto(
  barberId: string,
): Promise<BarberCommandResult> {
  const { barbershop } = await requireOwner();
  const barber = isId(barberId)
    ? await getBarber(barbershop.id, barberId)
    : null;
  if (!barber) return { ok: false, error: "unknown" };
  if (barber.photo_path) {
    if (!(await clearBarberPhoto(barbershop.id, barber.id))) {
      return { ok: false, error: "unknown" };
    }
    await removeImages([barber.photo_path]);
  }
  revalidateTeam(barber.id);
  return { ok: true };
}
