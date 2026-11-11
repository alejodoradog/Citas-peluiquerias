"use server";

import { refreshPublicProfile } from "@/lib/cache-tags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { isOwnImageKey } from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { imageExists, removeImages } from "../datos/images";
import { barbershopNeedsSetup } from "../datos/setup";
import {
  clearShopImage,
  getShopProfile,
  updateShopProfile,
  type SavedShopProfile,
  type ShopImageKind,
} from "../datos/shop-profile";
import {
  parseShopProfile,
  type ShopProfileErrorCode,
} from "../dominio/profile";

// - image_invalid: a logo or cover sent is not an upload of this
//   barbershop's folder of that kind that exists (it expired, or the request
//   was tampered with); choose it again.
// - unknown: the database wrote nothing.
export type ShopProfileActionErrorCode =
  ShopProfileErrorCode | "image_invalid" | "unknown";

export type ShopProfileField =
  | "name"
  | "address"
  | "locality"
  | "whatsappPhone"
  | "location"
  | "logoPath"
  | "coverPath";

export type ShopProfileState = FormState<
  ShopProfileField,
  ShopProfileActionErrorCode
>;

export type ShopImageCommandResult = { ok: true } | { ok: false };

const TEXT_FIELDS = [
  "name",
  "address",
  "locality",
  "whatsappPhone",
  "location",
] as const;

// Twice the longest field (the address, 200): a typo is echoed back to be
// fixed, a forged megabyte is not.
const MAX_ECHO_LENGTH = 400;

const IMAGE_FIELDS = {
  logo: "logoPath",
  cover: "coverPath",
} as const satisfies Record<ShopImageKind, ShopProfileField>;

const SAVED_PATH = {
  logo: "logoPath",
  cover: "coverPath",
} as const satisfies Record<ShopImageKind, keyof SavedShopProfile>;

// What the form says about one image: nothing new (empty, or the saved one
// sent back), a new key of the right folder, or something to refuse.
type ImageChoice =
  { kind: "same" } | { kind: "new"; path: string } | { kind: "refused" };

function readImage(
  formData: FormData,
  barbershopId: string,
  saved: SavedShopProfile,
  image: ShopImageKind,
): ImageChoice {
  const sent = formData.get(IMAGE_FIELDS[image]);
  if (
    typeof sent !== "string" ||
    sent === "" ||
    sent === saved[SAVED_PATH[image]]
  ) {
    return { kind: "same" };
  }
  return isOwnImageKey(sent, barbershopId, image)
    ? { kind: "new", path: sent }
    : { kind: "refused" };
}

const echoOf = (choice: ImageChoice) =>
  choice.kind === "new" ? choice.path : "";

function revalidatePanel() {
  // The name and the photos show across the panel: Más, Compartir (D-62),
  // the end of the wizard (D-14) and D-57 itself.
  revalidatePath(routes.panel, "layout");
  // Named too: no layout file sits at /panel.
  for (const path of [
    routes.panelMore,
    routes.panelShare,
    routes.setupDone,
    routes.panelShopProfile,
  ]) {
    revalidatePath(path);
  }
}

// D-57, "Guardar". The data of the owner's barbershop: nothing the browser
// sends picks the barbershop. A new logo or cover must be an upload of its
// own folder that really exists; the one it replaces is deleted once the row
// no longer points at it (decision 7 of task 2.2). Then back to Más, as the
// design does. Changing the name does not change the link (D-61, 2.4e).
export async function saveShopProfile(
  _previous: ShopProfileState,
  formData: FormData,
): Promise<ShopProfileState> {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) redirect(routes.setup);

  const saved = await getShopProfile(barbershop.id);
  const logo = readImage(formData, barbershop.id, saved, "logo");
  const cover = readImage(formData, barbershop.id, saved, "cover");

  const form = readForm(formData, {
    fields: TEXT_FIELDS,
    parse: (input) => parseShopProfile(input, saved),
  });
  if (!form.valid) {
    // Only an invalid form echoes what was sent; a forged one could be long.
    if (form.state.status !== "invalid") return form.state;
    return {
      ...form.state,
      values: {
        ...Object.fromEntries(
          Object.entries(form.state.values).map(([field, value]) => [
            field,
            value !== undefined && value.length <= MAX_ECHO_LENGTH ? value : "",
          ]),
        ),
        // The uploads survive the fix, unless they are not this
        // barbershop's own.
        logoPath: echoOf(logo),
        coverPath: echoOf(cover),
      },
    };
  }

  // Never trust the browser's word that it uploaded: the file must exist.
  const [logoOk, coverOk] = await Promise.all(
    [logo, cover].map(async (choice) =>
      choice.kind === "new" ? imageExists(choice.path) : choice.kind === "same",
    ),
  );
  if (!logoOk || !coverOk) {
    return {
      status: "failed",
      error: "image_invalid",
      values: {
        ...form.values,
        logoPath: logoOk ? echoOf(logo) : "",
        coverPath: coverOk ? echoOf(cover) : "",
      },
    };
  }

  const newLogo = logo.kind === "new" ? logo.path : undefined;
  const newCover = cover.kind === "new" ? cover.path : undefined;
  const written = await updateShopProfile(barbershop.id, form.data, {
    ...(newLogo ? { logoPath: newLogo } : {}),
    ...(newCover ? { coverPath: newCover } : {}),
  });
  if (!written) {
    // Nothing points at the new uploads: they are checked keys of this
    // barbershop's folders, so they can go.
    await removeImages([newLogo, newCover].filter((p) => p !== undefined));
    return {
      status: "failed",
      error: "unknown",
      values: { ...form.values, logoPath: "", coverPath: "" },
    };
  }

  // The replaced files. The database only lets the row hold keys of its own
  // folders; checked here again so a delete never leaves them.
  const replaced = (
    [
      ["logo", newLogo && saved.logoPath],
      ["cover", newCover && saved.coverPath],
    ] as const
  ).flatMap(([image, path]) =>
    path && isOwnImageKey(path, barbershop.id, image) ? [path] : [],
  );
  if (replaced.length > 0) await removeImages(replaced);

  refreshPublicProfile(barbershop.id);
  revalidatePanel();
  redirect(routes.panelMore);
}

// D-57, "Quitar logo" and "Quitar portada": right away, as "Quitar foto" on
// D-54, so a barbershop that wants an image gone (Ley 1581) does not depend
// on the rest of the form being valid.
export async function removeShopImage(
  image: ShopImageKind,
): Promise<ShopImageCommandResult> {
  const { barbershop } = await requireOwner();
  if (image !== "logo" && image !== "cover") return { ok: false };
  const saved = await getShopProfile(barbershop.id);
  const path = saved[SAVED_PATH[image]];
  if (path) {
    if (!(await clearShopImage(barbershop.id, image, path))) {
      return { ok: false };
    }
    if (isOwnImageKey(path, barbershop.id, image)) await removeImages([path]);
  }
  refreshPublicProfile(barbershop.id);
  revalidatePanel();
  return { ok: true };
}
