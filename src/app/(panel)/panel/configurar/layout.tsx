import { Suspense, type ReactNode } from "react";
import { requireOwner } from "@/modulos/cuentas/guards";
import { LoadingState } from "@/ui/states";
import { SetupDraftProvider } from "./setup-draft";

// The draft survives moving between the steps of the wizard: this layout does
// not unmount while the owner goes from D-10 to D-13. It belongs to the
// active sede (task 2.6); the sede changes only with a full page load, which
// mounts the layout again.
export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupDraftForActiveBarbershop>{children}</SetupDraftForActiveBarbershop>
    </Suspense>
  );
}

async function SetupDraftForActiveBarbershop({
  children,
}: {
  children: ReactNode;
}) {
  const { barbershop } = await requireOwner();
  return (
    <SetupDraftProvider key={barbershop.id} barbershopId={barbershop.id}>
      {children}
    </SetupDraftProvider>
  );
}
