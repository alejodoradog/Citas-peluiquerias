import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfessional } from "@/modulos/cuentas/guards";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { AppointmentScreen } from "../../../_agenda-profesional/appointment-screen";

const t = textos.barbero;

export const metadata: Metadata = {
  title: t.cita.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-03 by the session (task 7.6b): with "Escribirle por WhatsApp" when the
// database brings the customer's phone (decision 0010, point 6). The id in
// the path is only a question: my_appointment answers for the session's own
// appointments and nothing else.
export default function MyAppointmentPage({
  params,
  searchParams,
}: PageProps<"/mi-agenda/citas/[id]">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <MyAppointment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MyAppointment({
  params,
  searchParams,
}: Pick<PageProps<"/mi-agenda/citas/[id]">, "params" | "searchParams">) {
  await requireProfessional();
  const { id } = await params;
  return (
    <AppointmentScreen appointmentId={id} aviso={(await searchParams).aviso} />
  );
}
