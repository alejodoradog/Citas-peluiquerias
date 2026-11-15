import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";

// The panel's screens are for owners who finished the setup wizard (task
// 2.1); the others go back to it. Pages call it inside a Suspense boundary.
// The wizard's mark comes with the access, in the same read as the active
// barbershop, so this costs no round trip of its own.
export async function requireReadyOwner() {
  const access = await requireOwner();
  if (access.barbershop.needsSetup) {
    redirect(routes.setup);
  }
  return access;
}
