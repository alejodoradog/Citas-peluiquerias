import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { now } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { createOwnerWalkInAction } from "@/modulos/agenda/acciones/walk-in";
import { loadWalkInChoices } from "@/modulos/agenda/datos/walk-in";
import { walkInStart } from "@/modulos/agenda/dominio/walk-in";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { WalkInForm } from "../../../../_cita-al-momento/walk-in-form";
import { requireReadyOwner } from "../../ready-owner";

const t = textos.citaAlMomento;

export const metadata: Metadata = { title: t.titulo };

// "Cita al momento" from the owner's agenda (task 7.7): the professional,
// the services and an optional name; it starts now. The agenda may bring
// ?profesional (the one it shows); anything else is ignored.
export default function OwnerWalkInPage({
  searchParams,
}: PageProps<"/panel/citas/al-momento">) {
  const close = { href: routes.panel, label: t.cerrar };
  return (
    <Suspense
      fallback={
        <FlowShell
          header={<TopBar title={t.titulo} titleAs="h1" close={close} />}
        >
          <LoadingState label={t.cargando} />
        </FlowShell>
      }
    >
      <OwnerWalkIn searchParams={searchParams} close={close} />
    </Suspense>
  );
}

async function OwnerWalkIn({
  searchParams,
  close,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  close: { href: string; label: string };
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireReadyOwner(),
  ]);
  await connection();
  const instant = now();
  const { barbers, services } = await loadWalkInChoices(barbershop.id);
  // The one the agenda showed goes first, so it is the one chosen.
  const asked =
    typeof query.profesional === "string" ? query.profesional : null;
  const ordered = [
    ...barbers.filter((b) => b.id === asked),
    ...barbers.filter((b) => b.id !== asked),
  ];

  return (
    <WalkInForm
      action={createOwnerWalkInAction}
      close={close}
      startsAt={walkInStart(instant)}
      services={services}
      barbers={ordered}
    />
  );
}
