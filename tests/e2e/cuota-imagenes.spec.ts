import { expect, test } from "@playwright/test";
import {
  createConfirmedOwner,
  imageQuotaOf,
  signedInClient,
  uniqueEmail,
  uploadImagesPastPolicies,
} from "./helpers/supabase";

// Security review of task 2.4 (migration add_image_upload_tickets): against
// the real Storage, an account that skips the app cannot sign an upload URL
// for a path it did not reserve, and reserve_image_upload holds the quota.
// No browser: this is what an account could do with its session alone.
const PASSWORD = "clave-segura-1";
const IMAGE = new Blob(["webp"], { type: "image/webp" });

test("an upload URL is signed only for a reserved path, within the quota", async () => {
  test.setTimeout(60_000);
  const email = uniqueEmail("cuota");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería La Cuota",
  });
  const owner = await signedInClient(email, PASSWORD);
  const { id, quota } = await imageQuotaOf(slug);
  const images = owner.storage.from("images");
  const newKey = () => `${id}/barbers/${crypto.randomUUID()}.webp`;

  // Without a reservation, Storage signs nothing and takes no upload.
  const unreserved = newKey();
  expect((await images.createSignedUploadUrl(unreserved)).error).not.toBeNull();
  // The content type the bucket accepts, so only the missing ticket refuses it.
  expect(
    (await images.upload(unreserved, IMAGE, { contentType: "image/webp" }))
      .error,
  ).not.toBeNull();

  // Reserved, it signs and the upload with the URL works.
  const reserved = newKey();
  const reservation = await owner.rpc("reserve_image_upload", {
    p_path: reserved,
  });
  expect(reservation.error).toBeNull();
  const signed = await images.createSignedUploadUrl(reserved);
  expect(signed.error).toBeNull();
  const uploaded = await images.uploadToSignedUrl(
    reserved,
    signed.data!.token,
    IMAGE,
    { contentType: "image/webp" },
  );
  expect(uploaded.error).toBeNull();

  // Another barbershop's folder is refused.
  const foreign = await owner.rpc("reserve_image_upload", {
    p_path: `${crypto.randomUUID()}/barbers/${crypto.randomUUID()}.webp`,
  });
  expect(foreign.error?.code).toBe("42501");

  // Fill the quota (the image above counts) and ask for one more.
  await uploadImagesPastPolicies(id, quota - 1);
  const over = await owner.rpc("reserve_image_upload", { p_path: newKey() });
  expect(over.error).toMatchObject({ code: "23514", hint: "image_quota" });
  expect((await images.createSignedUploadUrl(newKey())).error).not.toBeNull();
});
