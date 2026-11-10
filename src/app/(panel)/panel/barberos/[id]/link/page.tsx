import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBogotaDayMonth } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  issueBarberLink,
  turnOffBarberLink,
} from "@/modulos/barberias/acciones/barber-links";
import { getBarber } from "@/modulos/barberias/datos/barbers";
import { barberLinkState } from "@/modulos/barberias/dominio/barber-link";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../../ready-owner";
import { BarberLinkPanel } from "../../barber-link-panel";

const t = textos.barberos.link;

export const metadata: Metadata = { title: t.tituloCargando };

// D-56 for a barber of the owner's barbershop. An id that is not one, a
// barber of another barbershop and the owner's own barber are "not found".
// The page renders only the state of the link, never a link: the database
// keeps its hash, and a new one travels only in the answer to the tap.
export default function BarberLinkPage({
  params,
}: PageProps<"/panel/barberos/[id]/link">) {
  return (
    <Suspense fallback={<LinkLoading />}>
      <BarberLink params={params} />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the barber loads. The id is not
// known yet, so it goes back to the team.
function LinkLoading() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.tituloCargando}
          titleAs="h1"
          back={{ href: routes.panelBarbers, label: textos.ui.volver }}
        />
      }
    >
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function BarberLink({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const barber = await getBarber(barbershop.id, id);
  if (!barber) notFound();
  const state = barberLinkState({
    isOwner: barber.is_owner,
    linkActive: barber.link_active,
    linkIssuedAt: barber.link_issued_at,
  });
  if (state === "owner") notFound();

  return (
    <BarberLinkPanel
      barber={{
        id: barber.id,
        displayName: barber.display_name,
        active: barber.active,
        state,
        sentOn: barber.link_issued_at
          ? formatBogotaDayMonth(new Date(barber.link_issued_at))
          : null,
      }}
      issueLink={issueBarberLink}
      turnOffLink={turnOffBarberLink}
    />
  );
}
