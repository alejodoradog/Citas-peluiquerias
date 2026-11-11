"use server";

import {
  extensionFor,
  isImageKind,
  isOwnImageKey,
  newImageKey,
  type ImageKind,
  type ImageUploadTicket,
} from "@/lib/imagenes/keys";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  imageInUse,
  removeImages,
  reserveImageUpload,
  signImageUpload,
} from "../datos/images";

// The first step of an image upload (decision 0007): a new key in the
// folder of that kind of the owner's barbershop (a barber's photo on D-54,
// the logo or the cover on D-57) and a signed URL for it. The browser uploads
// there and sends the key back with its form, whose action checks it again.
// The key is reserved first: the database holds the image quota there, and
// Storage signs no key that was not reserved (migration
// add_image_upload_tickets).
export async function requestImageUpload(
  kind: ImageKind,
  mime: string,
): Promise<ImageUploadTicket> {
  const { barbershop } = await requireOwner();
  const extension = extensionFor(mime);
  if (!isImageKind(kind) || !extension) {
    return { ok: false, error: "photo_upload_failed" };
  }
  const path = newImageKey(barbershop.id, kind, extension);
  const reservation = await reserveImageUpload(path);
  if (reservation !== "reserved") {
    return {
      ok: false,
      error: reservation === "quota" ? "photo_quota" : "photo_upload_failed",
    };
  }
  const token = await signImageUpload(path);
  return token
    ? { ok: true, path, token }
    : { ok: false, error: "photo_upload_failed" };
}

// An image uploaded in this visit and dropped before "Guardar": the owner
// chose another one or removed it. It leaves the bucket now instead of
// waiting for the monthly cleanup (decision 0007). Only a key of that kind
// in the active sede's folder, and never one a barber, the logo or the cover
// points at: the browser sends the key, so a saved image must not be
// deleted through here. Best effort: what fails stays as an orphan.
export async function discardImageUpload(
  kind: ImageKind,
  path: string,
): Promise<void> {
  const { barbershop } = await requireOwner();
  if (!isImageKind(kind) || !isOwnImageKey(path, barbershop.id, kind)) return;
  if (await imageInUse(path)) return;
  await removeImages([path]);
}
