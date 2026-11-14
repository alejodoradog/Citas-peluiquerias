import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  getOwnerAppointment,
  loadOwnerBookingData,
} from "@/modulos/agenda/datos/owner-appointment";
import { appointmentActions } from "@/modulos/agenda/dominio/owner-slots";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../../ready-owner";
import { bookingPayload } from "../../booking-payload";
import { shortWhen } from "../../labels";
import { RescheduleForm } from "./reschedule-form";

const t = textos.agenda.reprogramar;

export const metadata: Metadata = { title: t.titulo };

// D-37 (task 4.2): a confirmed appointment to another barber, day or time,
// with the same services and length. Anything else goes back to D-34.
export default function ReschedulePage({
  params,
}: PageProps<"/panel/citas/[id]/reprogramar">) {
  return (
    <Suspense
      fallback={
        <FlowShell
          header={
            <TopBar
              title={t.titulo}
              titleAs="h1"
              close={{ href: routes.panel, label: textos.ui.cerrar }}
            />
          }
        >
          <LoadingState label={textos.agenda.detalleCita.cargando} />
        </FlowShell>
      }
    >
      <Reschedule params={params} />
    </Suspense>
  );
}

async function Reschedule({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const appointment = await getOwnerAppointment(barbershop.id, id);
  if (!appointment) notFound();
  await connection();
  const instant = now();
  // Only a confirmed appointment that has not started moves (task 4.2b).
  if (!appointmentActions(appointment, instant).reschedule) {
    redirect(routes.panelAppointment(appointment.id));
  }
  const data = await loadOwnerBookingData(barbershop.id, instant);
  const minutes = Math.round(
    (appointment.end.getTime() - appointment.start.getTime()) / 60_000,
  );

  return (
    <RescheduleForm
      appointmentId={appointment.id}
      summary={[
        appointment.customer.name,
        shortWhen(appointment.start, toBogotaDate(instant)),
        appointment.services.map((s) => s.name).join(" + "),
        appointment.barber.name,
      ].join(" · ")}
      minutes={minutes}
      barberId={appointment.barber.id}
      serviceIds={appointment.services.map((s) => s.id)}
      booking={bookingPayload(data, instant)}
    />
  );
}
