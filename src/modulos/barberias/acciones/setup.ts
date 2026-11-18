"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { inviteAfterSaving } from "@/modulos/cuentas/acciones/invite-after-saving";
import { shouldInviteOnSave } from "@/modulos/cuentas/dominio/professional-access";
import { requireOwner } from "@/modulos/cuentas/guards";
import { listBarbers } from "../datos/barbers";
import { completeBarbershopSetup } from "../datos/setup";
import { getShopProfile, saveShopLocation } from "../datos/shop-profile";
import { DEFAULT_BARBERSHOP_HOURS } from "../dominio/hours";
import { readLocation } from "../dominio/profile";
import { parseSetupPayload } from "../dominio/setup";

export type SetupErrorCode = "setup_invalid" | "plan_limit" | "unknown";

export type SetupLocationErrorCode =
  "location_required" | "location_invalid" | "unknown";

export type SetupLocationState = FormState<"location", SetupLocationErrorCode>;

// The location step of the wizard (task 7.3): the point the owner marked with
// their phone, required to go on. It is saved right away, in the owner's own
// establishment: it does not wait in the draft for the end of the wizard.
export async function saveSetupLocation(
  _previous: SetupLocationState,
  formData: FormData,
): Promise<SetupLocationState> {
  const { barbershop } = await requireOwner();
  // Only while the wizard lasts: afterwards the point is changed in Datos
  // (D-57), which also refreshes the public page.
  if (!barbershop.needsSetup) redirect(routes.panel);
  const sent = formData.get("location");
  const value = typeof sent === "string" ? sent.slice(0, 60) : "";
  const location = readLocation(value);
  if (!location) {
    return {
      status: "invalid",
      fieldErrors: {
        location: location === null ? "location_required" : "location_invalid",
      },
      values: { location: location === null ? "" : value },
    };
  }
  if (!(await saveShopLocation(barbershop.id, location))) {
    return { status: "failed", error: "unknown", values: { location: value } };
  }
  redirect(routes.setupTeam);
}

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

  // The location is required (task 7.3), and the database refuses to finish
  // without it: an owner who skipped its step is sent back to it.
  if (!(await getShopProfile(barbershop.id)).location) {
    redirect(routes.setupLocation);
  }

  const result = await completeBarbershopSetup(
    barbershop.id,
    DEFAULT_BARBERSHOP_HOURS,
    payload.data,
  );
  // The point went away between the check above and the save.
  if (result === "location_required") redirect(routes.setupLocation);
  if (result === "plan_limit") {
    return { status: "failed", error: "plan_limit", values: {} };
  }
  if (result === "failed") {
    return { status: "failed", error: "unknown", values: {} };
  }
  // Task 8.17: the wizard is saved, so each professional with an email gets
  // their invitation now. Only here, on "saved": a second tap or tab finds
  // "already_done" and invites nobody again.
  if (result === "saved") await inviteTeamAfterSetup(barbershop.id);
  redirect(routes.setupDone);
}

// One by one, with the same function as saving a professional (task 8.16):
// the owner who attends, an inactive one and one without email are left out
// by shouldInviteOnSave. The establishment is set up either way, so no
// failure (of one invitation or of reading the team) stops the others or the
// redirect; the last screen reads from the database who got theirs.
async function inviteTeamAfterSetup(barbershopId: string): Promise<void> {
  let team: Awaited<ReturnType<typeof listBarbers>>;
  try {
    team = await listBarbers(barbershopId);
  } catch {
    return;
  }
  for (const barber of team) {
    if (
      !shouldInviteOnSave({
        isOwner: barber.is_owner,
        active: barber.active,
        previousEmail: null,
        email: barber.email,
        state: "none",
      })
    ) {
      continue;
    }
    try {
      await inviteAfterSaving(barber.id);
    } catch {
      // Nothing to do: the last screen says who did not get theirs.
    }
  }
}
