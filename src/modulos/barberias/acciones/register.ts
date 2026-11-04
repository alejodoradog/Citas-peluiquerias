"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toAccountError } from "@/modulos/cuentas/datos/auth-errors";
import {
  readFields,
  type FormState,
} from "@/modulos/cuentas/acciones/form-state";
import { findFreeSlug } from "../datos/slugs";
import { parseRegistration } from "../dominio/registration";
import { slugFromName } from "../dominio/slug";

const FIELDS = [
  "ownerName",
  "barbershopName",
  "phone",
  "email",
  "password",
] as const;

// Signs the owner up. The database creates the barbershop and the owner
// profile in the same transaction (decision 0004).
export async function registerBarbershop(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readFields(formData, FIELDS);
  const values = {
    ownerName: fields.ownerName,
    barbershopName: fields.barbershopName,
    phone: fields.phone,
    email: fields.email,
  };

  const parsed = parseRegistration(fields);
  if (!parsed.success) {
    return { fieldErrors: parsed.errors, values };
  }
  const registration = parsed.data;

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
    return { formError: toAccountError(error), values };
  }
  // With email confirmation on, there is no session until the owner confirms.
  if (!data.session) {
    return { notice: "check_email" };
  }
  redirect("/panel");
}
