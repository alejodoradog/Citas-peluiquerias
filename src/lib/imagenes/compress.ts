import { IMAGE_MAX_BYTES, type ImageMime } from "./keys";

// Photos are shrunk in the browser before they are uploaded (decision 0007):
// at most 400 px a side, WebP, or JPEG where the browser cannot encode WebP
// from a canvas (Safari on the iPhone). The pure parts below are tested; the
// canvas part only runs in a browser.

export const PHOTO_MAX_SIDE = 400;
export const PHOTO_QUALITY = 0.82;

// The cover of a barbershop (D-57) is a wide banner: 1200 px and under
// 100 KB, as decision 0007 budgets it. A busy photo gets less quality until
// it fits; one that still passes the bucket's 256 KB is refused by the
// picker (decision P10 of task 2.4, provisional).
export const COVER_COMPRESSION = {
  maxSide: 1200,
  qualities: [PHOTO_QUALITY, 0.7, 0.55, 0.4],
  maxBytes: 100 * 1024,
} as const;

// Anything the browser calls an image. Whether it can actually be decoded is
// only known when createImageBitmap tries.
export function isImageFile(file: { type: string }): boolean {
  return file.type.startsWith("image/");
}

// The size that fits inside a square of `max` px, keeping the proportions.
// Smaller images keep their size: they are never blown up.
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (!(width > 0 && height > 0)) {
    throw new RangeError(`Invalid image size: ${width}×${height}`);
  }
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// toBlob falls back to PNG when it cannot encode the format it was asked for,
// so the blob's own type says what came out. Null means "try the next one".
export function acceptedFormat(
  requested: ImageMime,
  produced: string | undefined,
): ImageMime | null {
  return produced === requested ? requested : null;
}

// The formats to try, in order.
export const PHOTO_FORMATS: readonly ImageMime[] = ["image/webp", "image/jpeg"];

function toBlob(
  canvas: HTMLCanvasElement,
  mime: ImageMime,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export class ImageCompressionError extends Error {}

// Encodes at each quality in turn and keeps the first result within
// maxBytes; when none fits, the last one, for the caller to refuse. Null
// when the browser cannot encode the format at all.
export async function shrinkToFit<T extends { size: number }>(
  qualities: readonly number[],
  maxBytes: number,
  encode: (quality: number) => Promise<T | null>,
): Promise<T | null> {
  let last: T | null = null;
  for (const quality of qualities) {
    const encoded = await encode(quality);
    if (!encoded) return last;
    last = encoded;
    if (encoded.size <= maxBytes) break;
  }
  return last;
}

// Decodes the file, draws it at most `maxSide` px a side and encodes it, at
// the first of `qualities` that fits in `maxBytes`. Throws
// ImageCompressionError when the browser cannot read or encode it.
export async function compressPhoto(
  file: Blob,
  {
    maxSide = PHOTO_MAX_SIDE,
    qualities = [PHOTO_QUALITY],
    maxBytes = IMAGE_MAX_BYTES,
  }: {
    maxSide?: number;
    qualities?: readonly number[];
    maxBytes?: number;
  } = {},
): Promise<{ blob: Blob; mime: ImageMime }> {
  let bitmap: ImageBitmap;
  try {
    // Phones save the rotation apart; "from-image" applies it.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageCompressionError("The browser cannot read this image");
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImageCompressionError("No 2D canvas");
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    for (const mime of PHOTO_FORMATS) {
      const blob = await shrinkToFit(qualities, maxBytes, async (quality) => {
        const encoded = await toBlob(canvas, mime, quality);
        return encoded && acceptedFormat(mime, encoded.type) ? encoded : null;
      });
      if (blob) return { blob, mime };
    }
    throw new ImageCompressionError("The browser cannot encode WebP or JPEG");
  } finally {
    bitmap.close();
  }
}
