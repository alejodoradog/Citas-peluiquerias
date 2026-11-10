import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { savePolicies } from "@/modulos/barberias/acciones/policies";
import { getPolicies } from "@/modulos/barberias/datos/policies";
import { FlowShell } from "@/ui/flow-shell";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { PoliciesForm } from "./policies-form";

const t = textos.politicas;

export const metadata: Metadata = { title: t.titulo };

// D-60, Más › Reservas y cancelaciones.
export default function PoliciesPage() {
  return (
    <Suspense fallback={<PoliciesLoading />}>
      <BarbershopPolicies />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the policies load.
function PoliciesLoading() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelMore, label: textos.ui.volver }}
        />
      }
    >
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function BarbershopPolicies() {
  const { barbershop } = await requireReadyOwner();
  const saved = await getPolicies(barbershop.id);
  // Keyed by what is saved, so the selects start from it when Next.js shows
  // a payload it kept and then refreshes it; and they start from it again
  // when the owner leaves a draft unsaved and comes back (FreshOnReturn).
  return (
    <FreshOnReturn>
      <PoliciesForm
        key={`${saved.minBookingNoticeMinutes}:${saved.cancellationNoticeHours}`}
        action={savePolicies}
        saved={saved}
      />
    </FreshOnReturn>
  );
}
