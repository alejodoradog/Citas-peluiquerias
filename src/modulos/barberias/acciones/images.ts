"use server";

import {
  extensionFor,
  isImageKind,
  newImageKey,
  type ImageKind,
  type ImageUploadTicket,
} from "@/lib/imagenes/keys";
import { requireOwner } from "@/modulos/cuentas/guards";
import { signImageUpload } from "../datos/images";

// The first step of an image upload (decision 0007): a new key in the
// folder of that kind of the owner's barbershop (a barber's photo on D-54,
// the logo or the cover on D-57) and a signed URL for it. The browser uploads
// there and sends the key back with its form, whose action checks it again.
// Storage applies its insert policy, quota included, when it signs.
export async function requestImageUpload(
  kind: ImageKind,
  mime: string,
): Promise<ImageUploadTicket> {
  const { barbershop } = await requireOwner();
  const extension = extensionFor(mime);
  if (!isImageKind(kind) || !extension) return { ok: false };
  const path = newImageKey(barbershop.id, kind, extension);
  const token = await signImageUpload(path);
  return token ? { ok: true, path, token } : { ok: false };
}
