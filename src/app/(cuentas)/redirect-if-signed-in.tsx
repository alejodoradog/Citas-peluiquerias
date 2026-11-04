import { redirectIfSignedIn } from "@/modulos/cuentas/guards";

// Reads the session, so it renders inside a Suspense boundary.
export async function RedirectIfSignedIn() {
  await redirectIfSignedIn();
  return null;
}
