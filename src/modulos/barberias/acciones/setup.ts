"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { completeBarbershopSetup } from "../datos/setup";
import { DEFAULT_BARBERSHOP_HOURS } from "../dominio/hours";
import { parseSetupPayload } from "../dominio/setup";

export type SetupErrorCode = "setup_invalid" | "unknown";

export type SetupState = FormState<never, SetupErrorCode>;

// Saves the setup wizard (task 2.1). The draft arrives as JSON in a hidden
// field; it is checked again here because it comes from the browser. The
// barbershop is always the owner's own, never one named by the form.
export async function completeSetup(
  _previous: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const { barbershop } = await requireOwner();

  let input: unknown;
  try {
    input = JSON.parse(String(formData.get("setup") ?? ""));
  } catch {
    return { status: "failed", error: "setup_invalid", values: {} };
  }
  const payload = parseSetupPayload(input);
  if (!payload.success) {
    return { status: "failed", error: "setup_invalid", values: {} };
  }

  const result = await completeBarbershopSetup(
    barbershop.id,
    DEFAULT_BARBERSHOP_HOURS,
    payload.data,
  );
  if (result === "failed") {
    return { status: "failed", error: "unknown", values: {} };
  }
  redirect(routes.setupDone);
}
