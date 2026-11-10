"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { getPolicies, updatePolicies } from "../datos/policies";
import { barbershopNeedsSetup } from "../datos/setup";
import { parsePoliciesForm, type PolicyErrorCode } from "../dominio/policies";

// - *_invalid: a value the screen does not offer (nor the one saved).
// - unknown: the database wrote nothing.
export type PoliciesActionErrorCode = PolicyErrorCode | "unknown";

export type PoliciesField = "minBookingNotice" | "cancellationNotice";

export type PoliciesState = FormState<PoliciesField, PoliciesActionErrorCode>;

const FIELDS = ["minBookingNotice", "cancellationNotice"] as const;

// The options are a few digits; anything far longer is not echoed back.
const MAX_ECHO_LENGTH = 10;

// D-60, "Guardar". Both policies of the owner's barbershop: nothing the
// browser sends picks the barbershop. Then back to Más, as the design does.
export async function savePolicies(
  _previous: PoliciesState,
  formData: FormData,
): Promise<PoliciesState> {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);

  const saved = await getPolicies(barbershop.id);
  const form = readForm(formData, {
    fields: FIELDS,
    parse: (input) => parsePoliciesForm(input, saved),
  });
  if (!form.valid) {
    // Only an invalid form echoes what was sent; a forged one could be long.
    if (form.state.status !== "invalid") return form.state;
    return {
      ...form.state,
      values: Object.fromEntries(
        Object.entries(form.state.values).map(([field, value]) => [
          field,
          value !== undefined && value.length <= MAX_ECHO_LENGTH ? value : "",
        ]),
      ),
    };
  }

  if (!(await updatePolicies(barbershop.id, form.data))) {
    return { status: "failed", error: "unknown", values: form.values };
  }

  revalidatePath(routes.panelMore);
  revalidatePath(routes.panelPolicies);
  redirect(routes.panelMore);
}
