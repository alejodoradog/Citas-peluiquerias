import { requireEnv } from "@/lib/supabase/env";

// Keys of the public bucket "images" (decision 0007, migration
// add_images_bucket): <barbershop_id>/<kind>/<uuid>.<webp|jpg>. A new image
// always gets a new key, so a cached copy of the old one never shows, and the
// random uuid keeps a barbershop's files from being guessed.

export const IMAGES_BUCKET = "images";

export type ImageKind = "barbers" | "logo" | "cover";
export type ImageExtension = "webp" | "jpg";
export type ImageMime = "image/webp" | "image/jpeg";

// The bucket's file_size_limit: 256 KB.
export const IMAGE_MAX_BYTES = 256 * 1024;

const EXTENSIONS: Record<ImageMime, ImageExtension> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

// The extension the bucket stores for a format, or null for any format it
// does not accept.
export function extensionFor(mime: unknown): ImageExtension | null {
  return typeof mime === "string" && Object.hasOwn(EXTENSIONS, mime)
    ? EXTENSIONS[mime as ImageMime]
    : null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// The same rule as private.is_image_key in the database.
const IMAGE_KEY = new RegExp(
  `^(${UUID})/(barbers|logo|cover)/${UUID}\\.(webp|jpg)$`,
);

export function newImageKey(
  barbershopId: string,
  kind: ImageKind,
  extension: ImageExtension,
): string {
  return `${barbershopId.toLowerCase()}/${kind}/${crypto.randomUUID()}.${extension}`;
}

// A key the database accepts, in this barbershop's folder of that kind. Keys
// come back from the browser, so anything else is refused before it is used.
export function isOwnImageKey(
  path: unknown,
  barbershopId: string,
  kind: ImageKind,
): path is string {
  if (typeof path !== "string") return false;
  const match = IMAGE_KEY.exec(path);
  return (
    match !== null &&
    match[1] === barbershopId.toLowerCase() &&
    match[2] === kind
  );
}

// The address anyone can load the image from. The bucket is public on
// purpose: the booking page shows these photos.
export function publicImageUrl(path: string): string {
  const url = requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  return `${url.replace(/\/+$/, "")}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}

// Why a photo did not upload, as the photo picker reports it:
// - photo_not_image: the file is not an image;
// - photo_unreadable: the browser cannot open or shrink it;
// - photo_too_big: even shrunk, it passes IMAGE_MAX_BYTES;
// - photo_upload_failed: no signed URL or the upload failed (the network).
export type ImageUploadErrorCode =
  | "photo_not_image"
  | "photo_unreadable"
  | "photo_too_big"
  | "photo_upload_failed";
