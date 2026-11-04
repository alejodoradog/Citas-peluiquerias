import { redirectIfSignedIn } from "@/lib/auth/access";

// Reads the session, so it renders inside a Suspense boundary.
export async function RedirectIfSignedIn() {
  await redirectIfSignedIn();
  return null;
}
