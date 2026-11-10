import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import { requireOwner } from "@/modulos/cuentas/guards";

// The panel's screens are for owners who finished the setup wizard (task
// 2.1); the others go back to it. Pages call it inside a Suspense boundary.
export async function requireReadyOwner() {
  const access = await requireOwner();
  if (await barbershopNeedsSetup(access.barbershop.id)) {
    redirect(routes.setup);
  }
  return access;
}
