import "server-only";
import { IMAGE_KINDS, IMAGES_BUCKET } from "@/lib/imagenes/keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Images of the bucket "images", always through the owner's session: the
// storage policies keep every call inside the folders of their barbershops
// (migration add_images_bucket). The service key is never used here.

async function bucket() {
  const supabase = await createSupabaseServerClient();
  return supabase.storage.from(IMAGES_BUCKET);
}

// Reserves `path` for one upload (migration add_image_upload_tickets). The
// database holds the quota of the barbershop here, under a lock, and the
// insert policy of Storage refuses to sign or upload a path not reserved in
// the last 5 minutes.
export type ImageReservation = "reserved" | "quota" | "failed";

type DatabaseError = { code?: string; hint?: string | null };

export function imageReservationError(error: DatabaseError): ImageReservation {
  return error.code === "23514" && error.hint === "image_quota"
    ? "quota"
    : "failed";
}

export async function reserveImageUpload(
  path: string,
): Promise<ImageReservation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reserve_image_upload", {
    p_path: path,
  });
  return error ? imageReservationError(error) : "reserved";
}

// A signed URL to upload one new image at `path` (decision 0007). Storage
// checks the insert policy now, with the session: a key outside the owner's
// folders, or not reserved first, gets no URL.
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

// Whether a barber, or the logo or cover of a barbershop, points at `path`.
// Read with the owner's session: RLS shows the rows of their barbershops,
// which is where their keys live. When it cannot tell, it says yes, so an
// image in use is never deleted.
export async function imageInUse(path: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const found = await Promise.all([
    supabase.from("barbers").select("id").eq("photo_path", path).limit(1),
    supabase.from("barbershops").select("id").eq("logo_path", path).limit(1),
    supabase
      .from("barbershops")
      .select("id")
      .eq("cover_photo_path", path)
      .limit(1),
  ]);
  return found.some(({ data, error }) => error !== null || data.length > 0);
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

// Task 2.6b: every image of a deleted sede (logo, cover, barber photos). The
// owner no longer belongs to it; the policies of migration
// add_barbershop_limit_and_deletion let the account that deleted it list and
// delete that folder only. Best effort, like removeImages: what fails stays
// as an orphan for the monthly cleanup.
const LIST_PAGE = 1000;

export async function removeBarbershopImages(
  barbershopId: string,
): Promise<void> {
  try {
    const images = await bucket();
    const folders = await Promise.all(
      IMAGE_KINDS.map(async (kind) => {
        const folder = `${barbershopId.toLowerCase()}/${kind}`;
        const { data, error } = await images.list(folder, { limit: LIST_PAGE });
        if (error) {
          console.error("Could not list images", error.message);
          return [];
        }
        return data.map((file) => `${folder}/${file.name}`);
      }),
    );
    await removeImages(folders.flat());
  } catch (error) {
    console.error("Could not delete images", error);
  }
}
