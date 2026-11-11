import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { routes } from "@/lib/routes";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import type { Access } from "@/modulos/cuentas/datos/access";
import { requireOwner } from "@/modulos/cuentas/guards";

type OwnerAccess = Extract<Access, { kind: "owner" }>;

// The wizard is for owners whose barbershop has no services yet. Once set up,
// the steps send them to the panel; services and barbers are edited in Más.
// Each page checks it: the shared layout does not render again between steps.
export async function SetupStepGate({
  children,
}: {
  children: (
    owner: Pick<OwnerAccess, "name" | "barbershop" | "barbershops">,
  ) => ReactNode;
}) {
  const access = await requireOwner();
  if (!(await barbershopNeedsSetup(access.barbershop.id))) {
    redirect(routes.panel);
  }
  return children(access);
}
