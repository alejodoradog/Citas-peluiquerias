"use server";

import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { toAccountError, type AccountError } from "@/lib/supabase/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rememberActiveBarbershop } from "@/modulos/cuentas/datos/active-barbershop";
import { requireOwner } from "@/modulos/cuentas/guards";
import { createBarbershopRow, deleteBarbershopRow } from "../datos/barbershops";
import { removeBarbershopImages } from "../datos/images";
import { findFreeSlug } from "../datos/slugs";
import {
  canDeleteBarbershop,
  confirmsBarbershopName,
} from "../dominio/barbershop-rules";
import {
  parseNewBarbershop,
  type NewBarbershopErrorCode,
} from "../dominio/new-barbershop";
import {
  parseRegistration,
  type RegistrationErrorCode,
} from "../dominio/registration";
import { slugFromName } from "../dominio/slug";

export type RegistrationField =
  "ownerName" | "barbershopName" | "phone" | "email" | "password";

export type RegistrationState = FormState<
  RegistrationField,
  RegistrationErrorCode | AccountError,
  "check_email"
>;

// Signs the owner up. The database creates the barbershop and the owner
// profile in the same transaction (decision 0004).
export async function registerBarbershop(
  _previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const form = readForm(formData, {
    fields: ["ownerName", "barbershopName", "phone", "email", "password"],
    secret: ["password"],
    parse: parseRegistration,
  });
  if (!form.valid) {
    return form.state;
  }
  const registration = form.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: registration.email,
    password: registration.password,
    options: {
      data: {
        owner_name: registration.ownerName,
        barbershop_name: registration.barbershopName,
        barbershop_slug: await findFreeSlug(
          slugFromName(registration.barbershopName),
        ),
        phone: registration.phone,
      },
    },
  });

  if (error) {
    const accountError = toAccountError(error);
    // Answers the same as a new signup, so the form never reveals which emails
    // have an account. No email is sent; the notice covers that case.
    if (accountError === "email_taken") {
      return { status: "done", notice: "check_email" };
    }
    return { status: "failed", error: accountError, values: form.values };
  }
  // With email confirmation on, there is no session until the owner confirms.
  if (!data.session) {
    return { status: "done", notice: "check_email" };
  }
  redirect(routes.panel);
}

export type NewBarbershopField = "name" | "whatsappPhone";

export type NewBarbershopActionErrorCode =
  NewBarbershopErrorCode | "barbershop_limit" | "unknown";

export type NewBarbershopState = FormState<
  NewBarbershopField,
  NewBarbershopActionErrorCode,
  "created"
>;

// A request id as the screen makes it (crypto.randomUUID): anything else is
// not this form.
const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// "Nueva sede" (task 2.6): another barbershop for the same owner, with the
// company trial (spec, P7). Its link comes from the name, as at sign-up; a
// link taken between the lookup and the insert is looked up again once. The
// form's request id makes a second tap, or the form sent again, return the
// sede the first one created instead of another one (decision P1 of task
// 2.6). The new sede becomes the active one; the screen then loads its setup
// wizard.
export async function createBarbershop(
  _previous: NewBarbershopState,
  formData: FormData,
): Promise<NewBarbershopState> {
  // The limit of 4 sedes (task 2.6b) is the database's to check: the screen
  // does not offer the form at the limit, but a retried request of the sede
  // that reached it must still get that sede back, not an error.
  await requireOwner();
  const form = readForm(formData, {
    fields: ["name", "whatsappPhone"],
    parse: parseNewBarbershop,
  });
  if (!form.valid) {
    return form.state;
  }
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId)) {
    return { status: "failed", error: "unknown", values: form.values };
  }

  const create = async () =>
    createBarbershopRow({
      name: form.data.name,
      slug: await findFreeSlug(slugFromName(form.data.name)),
      whatsappPhone: form.data.whatsappPhone,
      requestId,
    });
  let created = await create();
  if (!created.ok && created.code === "slug_taken") {
    created = await create();
  }
  if (!created.ok) {
    if (created.code === "phone_invalid") {
      return {
        status: "invalid",
        fieldErrors: { whatsappPhone: "phone_invalid" },
        values: form.values,
      };
    }
    return {
      status: "failed",
      error:
        created.code === "barbershop_limit" ? "barbershop_limit" : "unknown",
      values: form.values,
    };
  }

  await rememberActiveBarbershop(created.id);
  return { status: "done", notice: "created" };
}

export type DeleteBarbershopField = "confirmName";

export type DeleteBarbershopErrorCode =
  | "name_mismatch"
  | "barbershop_changed"
  | "last_barbershop"
  | "has_upcoming_appointments"
  | "unknown";

export type DeleteBarbershopState = FormState<
  DeleteBarbershopField,
  DeleteBarbershopErrorCode,
  "deleted"
>;

// "Eliminar esta sede" (task 2.6b, D-57). It deletes the ACTIVE sede, as the
// server knows it, never an id from the browser. The form still sends the id
// the screen showed: if another tab switched sede meanwhile, the two differ
// and nothing is deleted. The owner writes the sede's name to confirm, and
// the database checks the rest (owner, another sede left, no upcoming
// appointments). Then its images leave Storage, the oldest sede left becomes
// the active one and the screen loads the panel in full.
export async function deleteBarbershop(
  _previous: DeleteBarbershopState,
  formData: FormData,
): Promise<DeleteBarbershopState> {
  const { barbershop, barbershops } = await requireOwner();
  const typed = formData.get("confirmName");
  const values = { confirmName: typeof typed === "string" ? typed : "" };

  if (formData.get("barbershopId") !== barbershop.id) {
    return { status: "failed", error: "barbershop_changed", values };
  }
  if (!canDeleteBarbershop(barbershops.length)) {
    return { status: "failed", error: "last_barbershop", values };
  }
  if (!confirmsBarbershopName(typed, barbershop.name)) {
    return {
      status: "invalid",
      fieldErrors: { confirmName: "name_mismatch" },
      values,
    };
  }

  const deleted = await deleteBarbershopRow(barbershop.id);
  if (!deleted.ok) {
    return { status: "failed", error: deleted.code, values };
  }

  await removeBarbershopImages(barbershop.id);
  // Oldest first: the one getCurrentAccess would pick without a cookie.
  const next = barbershops.find((other) => other.id !== barbershop.id);
  if (next) await rememberActiveBarbershop(next.id);
  return { status: "done", notice: "deleted" };
}
