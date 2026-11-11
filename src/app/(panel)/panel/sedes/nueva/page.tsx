import type { Metadata } from "next";
import { Suspense } from "react";
import {
  formatBogotaDayMonth,
  now,
  startOfBogotaDay,
  toBogotaDate,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { createBarbershop } from "@/modulos/barberias/acciones/barbershops";
import { canAddBarbershop } from "@/modulos/barberias/dominio/barbershop-rules";
import { requireOwner } from "@/modulos/cuentas/guards";
import { trialHasEnded } from "@/modulos/suscripciones/dominio/trial";
import { ButtonLink } from "@/ui/button";
import { FlowShell } from "@/ui/flow-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { NewBarbershopForm } from "./new-barbershop-form";

const t = textos.sedes.nuevaSede;

export const metadata: Metadata = { title: t.titulo };

// Task 2.6, Más › Tus sedes › Nueva sede. Any owner may open another sede
// (spec, Usuarios y roles), whether or not the active one finished its
// setup; the new one gets the company trial (spec, P7).
export default function NewBarbershopPage() {
  return (
    <Suspense fallback={<NewBarbershopLoading />}>
      <NewBarbershop />
    </Suspense>
  );
}

const header = (
  <TopBar
    title={t.titulo}
    titleAs="h1"
    back={{ href: routes.panelMore, label: textos.ui.volver }}
  />
);

// Its bar, so the owner can leave, while the page loads.
function NewBarbershopLoading() {
  return (
    <FlowShell header={header}>
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function NewBarbershop() {
  const { companyTrialEndsOn, barbershops } = await requireOwner();
  // Task 2.6b: at the limit of 4 sedes, why there is no form. The database
  // refuses a fifth one anyway.
  if (!canAddBarbershop(barbershops.length)) {
    return (
      <FlowShell
        header={header}
        actions={
          <ButtonLink href={routes.panelMore} variant="secondary">
            {t.volver}
          </ButtonLink>
        }
      >
        <Notice tone="warning" title={t.limiteTitulo}>
          {t.limiteDetalle}
        </Notice>
      </FlowShell>
    );
  }
  return (
    <NewBarbershopForm
      action={createBarbershop}
      // One per visit: the same form sent twice creates one sede.
      requestId={crypto.randomUUID()}
      trial={{
        until: formatBogotaDayMonth(startOfBogotaDay(companyTrialEndsOn)),
        ended: trialHasEnded(companyTrialEndsOn, toBogotaDate(now())),
      }}
    />
  );
}
