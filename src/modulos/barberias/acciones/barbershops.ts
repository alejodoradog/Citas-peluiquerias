"use server";

import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { toAccountError, type AccountError } from "@/lib/supabase/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findFreeSlug } from "../datos/slugs";
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
    return {
      status: "failed",
      error: toAccountError(error),
      values: form.values,
    };
  }
  // With email confirmation on, there is no session until the owner confirms.
  if (!data.session) {
    return { status: "done", notice: "check_email" };
  }
  redirect(routes.panel);
}
