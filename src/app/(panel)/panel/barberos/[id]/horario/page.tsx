import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { saveBarberSchedule } from "@/modulos/barberias/acciones/barber-schedule";
import { getBarber } from "@/modulos/barberias/datos/barbers";
import { getBarbershopHours } from "@/modulos/barberias/datos/setup";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../../ready-owner";
import { ScheduleEditor } from "../../schedule-editor";

const t = textos.horario;

export const metadata: Metadata = { title: t.tituloCargando };

// D-55 for a barber of the owner's barbershop. An id that is not one, or a
// barber of another barbershop, is "not found", as in D-54.
export default function BarberSchedulePage({
  params,
}: PageProps<"/panel/barberos/[id]/horario">) {
  return (
    <Suspense fallback={<ScheduleLoading />}>
      <BarberSchedule params={params} />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the barber loads. The id is not
// known yet, so it goes back to the team.
function ScheduleLoading() {
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

async function BarberSchedule({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const [barber, shopHours] = await Promise.all([
    getBarber(barbershop.id, id),
    getBarbershopHours(barbershop.id),
  ]);
  if (!barber) notFound();

  return (
    <ScheduleEditor
      action={saveBarberSchedule}
      barber={{
        id: barber.id,
        displayName: barber.display_name,
        usesBarbershopHours: barber.uses_barbershop_hours,
        shifts: barber.shifts,
      }}
      shopHours={shopHours}
    />
  );
}
