"use server";

import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { toAccountError, type AccountError } from "@/lib/supabase/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rememberActiveBarbershop } from "@/modulos/cuentas/datos/active-barbershop";
import { requireOwner } from "@/modulos/cuentas/guards";
import { createBarbershopRow } from "../datos/barbershops";
import { findFreeSlug } from "../datos/slugs";
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

export type NewBarbershopActionErrorCode = NewBarbershopErrorCode | "unknown";

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
    return created.code === "phone_invalid"
      ? {
          status: "invalid",
          fieldErrors: { whatsappPhone: "phone_invalid" },
          values: form.values,
        }
      : { status: "failed", error: "unknown", values: form.values };
  }

  await rememberActiveBarbershop(created.id);
  return { status: "done", notice: "created" };
}
