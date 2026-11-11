"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { SAVED_PARAM, routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { updateBookingLink } from "../datos/booking-link";
import { barbershopNeedsSetup } from "../datos/setup";
import { isSlugAvailable } from "../datos/slugs";
import { parseNewSlug, type NewSlugErrorCode } from "../dominio/slug";

// - slug_invalid, slug_reserved, slug_same: what the owner typed is not a
//   link, is one of the app's routes, or is the current link.
// - slug_taken: another barbershop uses it, or left it (decision P1).
// - slug_change_limit: too many links left in 30 days (provisional P11).
// - unknown: the database wrote nothing.
export type BookingLinkActionErrorCode =
  NewSlugErrorCode | "slug_taken" | "slug_change_limit" | "unknown";

export type BookingLinkField = "slug";

export type BookingLinkState = FormState<
  BookingLinkField,
  BookingLinkActionErrorCode
>;

// What the chip under "Link nuevo" says about what the owner typed.
export type SlugCheck =
  | { status: "available"; slug: string }
  | { status: "taken"; slug: string }
  | { status: "refused"; error: NewSlugErrorCode };

// Three times the longest link (60): a typo is checked and echoed back, a
// forged megabyte is not.
const MAX_INPUT_LENGTH = 180;

function parseInput(input: string, current: string) {
  if (input.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: "slug_invalid" } as const;
  }
  return parseNewSlug(input, current);
}

// D-61, while the owner types. The link of the owner's barbershop is the one
// compared against; nothing the browser sends picks the barbershop.
export async function checkBookingLink(input: unknown): Promise<SlugCheck> {
  const { barbershop } = await requireOwner();
  const parsed = parseInput(
    typeof input === "string" ? input : "",
    barbershop.slug,
  );
  if (!parsed.ok) return { status: "refused", error: parsed.error };
  return (await isSlugAvailable(parsed.slug, barbershop.id))
    ? { status: "available", slug: parsed.slug }
    : { status: "taken", slug: parsed.slug };
}

function revalidateLink(oldSlug: string, newSlug: string) {
  // The link shows across the panel: Más, Compartir (D-62), the end of the
  // wizard (D-14) and D-61 itself; and both public pages change.
  revalidatePath(routes.panel, "layout");
  for (const path of [
    routes.panelMore,
    routes.panelShare,
    routes.setupDone,
    routes.panelBookingLink,
    `/${oldSlug}`,
    `/${newSlug}`,
  ]) {
    revalidatePath(path);
  }
}

// D-61, "Cambiar link". The link of the owner's barbershop: nothing the
// browser sends picks the barbershop. The database sets the old link aside
// so it leads to the new one, and refuses a link another barbershop uses or
// left. Then back to D-61, which says the link changed and offers to share
// the new one.
export async function changeBookingLink(
  _previous: BookingLinkState,
  formData: FormData,
): Promise<BookingLinkState> {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);

  const form = readForm(formData, {
    fields: ["slug"],
    parse: (input) => {
      const parsed = parseInput(input.slug, barbershop.slug);
      return parsed.ok
        ? { success: true, data: parsed.slug }
        : { success: false, errors: { slug: parsed.error } };
    },
  });
  const echo = (value: string | undefined) =>
    value !== undefined && value.length <= MAX_INPUT_LENGTH ? value : "";
  if (!form.valid) {
    if (form.state.status !== "invalid") return form.state;
    return { ...form.state, values: { slug: echo(form.state.values.slug) } };
  }

  const values = { slug: echo(form.values.slug) };
  const result = await updateBookingLink(barbershop.id, form.data);
  if (result === "slug_taken") {
    return { status: "invalid", fieldErrors: { slug: "slug_taken" }, values };
  }
  if (result !== "changed") {
    return { status: "failed", error: result, values };
  }

  revalidateLink(barbershop.slug, form.data);
  redirect(`${routes.panelBookingLink}?${SAVED_PARAM}=1`);
}
