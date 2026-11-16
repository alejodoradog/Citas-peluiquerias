import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { AppointmentScreen } from "../../../../_agenda-profesional/appointment-screen";
import { BarberLinkGone } from "../../../../_agenda-profesional/link-gone";

const t = textos.barbero;

export const metadata: Metadata = {
  title: t.cita.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-03 (task 4.4) by the private link: never the customer's phone, which
// only the session brings (task 7.6b).
export default function BarberAppointmentPage({
  params,
  searchParams,
}: PageProps<"/b/[token]/citas/[id]">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BarberAppointment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BarberAppointment({
  params,
  searchParams,
}: Pick<PageProps<"/b/[token]/citas/[id]">, "params" | "searchParams">) {
  const { token, id } = await params;
  await connection();
  return (
    <AppointmentScreen
      entry={{ kind: "link", token }}
      appointmentId={id}
      aviso={(await searchParams).aviso}
      gone={<BarberLinkGone />}
    />
  );
}
