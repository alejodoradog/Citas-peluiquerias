import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { IMAGES_BUCKET } from "./keys";

// A year: a key is never overwritten, a new image gets a new key.
const CACHE_SECONDS = String(60 * 60 * 24 * 365);

// Uploads a compressed image from the browser to the signed URL a Server
// Action handed out (requestImageUpload). True when the bucket stored it.
export async function uploadToSignedImageUrl(
  path: string,
  token: string,
  blob: Blob,
  contentType: string,
): Promise<boolean> {
  try {
    const { error } = await createSupabaseBrowserClient()
      .storage.from(IMAGES_BUCKET)
      .uploadToSignedUrl(path, token, blob, {
        contentType,
        cacheControl: CACHE_SECONDS,
      });
    return !error;
  } catch {
    // A network failure throws instead of returning an error.
    return false;
  }
}
