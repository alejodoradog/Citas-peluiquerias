import "server-only";
import { IMAGES_BUCKET } from "@/lib/imagenes/keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Images of the bucket "images", always through the owner's session: the
// storage policies keep every call inside the folders of their barbershops
// (migration add_images_bucket). The service key is never used here.

async function bucket() {
  const supabase = await createSupabaseServerClient();
  return supabase.storage.from(IMAGES_BUCKET);
}

// A signed URL to upload one new image at `path` (decision 0007). Storage
// checks the insert policy now, with the session, so a key outside the
// owner's folders gets no URL.
export async function signImageUpload(path: string): Promise<string | null> {
  const { data, error } = await (await bucket()).createSignedUploadUrl(path);
  return error ? null : data.token;
}

// Whether the browser really uploaded the image before a row points at it.
export async function imageExists(path: string): Promise<boolean> {
  try {
    const { data } = await (await bucket()).exists(path);
    return data;
  } catch {
    return false;
  }
}

// Deletes images that nothing points at any more. A failure leaves an
// orphan, which the monthly cleanup removes (decision 0007), so it does not
// fail the action that called it.
export async function removeImages(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await (await bucket()).remove([...paths]);
    if (error) console.error("Could not delete images", error.message);
  } catch (error) {
    console.error("Could not delete images", error);
  }
}
