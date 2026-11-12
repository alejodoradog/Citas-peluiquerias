import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { now } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  getCustomerMatch,
  loadOwnerBookingData,
} from "@/modulos/agenda/datos/owner-appointment";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../ready-owner";
import { bookingPayload } from "../booking-payload";
import { NewAppointmentForm } from "./new-appointment-form";

const t = textos.agenda.nueva;

export const metadata: Metadata = { title: t.titulo };

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

// D-38 (task 4.2): a manual appointment for someone who called or walked
// in. The agenda brings ?barbero, ?dia and ?hora (a free space) and the
// customer's profile brings ?cliente; anything else is ignored.
export default function NewAppointmentPage({
  searchParams,
}: PageProps<"/panel/citas/nueva">) {
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
          <LoadingState label={textos.agenda.cargando} />
        </FlowShell>
      }
    >
      <NewAppointment searchParams={searchParams} />
    </Suspense>
  );
}

async function NewAppointment({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireReadyOwner(),
  ]);
  await connection();
  const instant = now();
  const [data, customer] = await Promise.all([
    loadOwnerBookingData(barbershop.id, instant),
    getCustomerMatch(barbershop.id, first(query.cliente)),
  ]);

  return (
    <NewAppointmentForm
      booking={bookingPayload(data, instant)}
      customer={customer}
      defaults={{
        barbero: first(query.barbero),
        dia: first(query.dia),
        hora: first(query.hora),
      }}
    />
  );
}
