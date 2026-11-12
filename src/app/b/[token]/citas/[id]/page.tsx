import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { barberAgendaHref } from "@/lib/routes";
import {
  loadBarberAgenda,
  loadBarberAppointment,
} from "@/modulos/agenda/datos/barber-agenda";
import { canMark } from "@/modulos/agenda/dominio/barber-agenda";
import { appointmentLook } from "@/modulos/agenda/dominio/owner-agenda";
import { ActionBar } from "@/ui/action-bar";
import { Chip, type ChipTone } from "@/ui/chip";
import { Notice } from "@/ui/notice";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { dayLabel, timeRangeLabel } from "../../labels";
import { BarberLinkGone } from "../../link-gone";
import { MarkButtons } from "../../mark-buttons";
import { refusalOf } from "../../refusal";

const t = textos.barbero;
const a = textos.agenda;

export const metadata: Metadata = {
  title: t.cita.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const LOOK_TONES = {
  new: "warning",
  confirmed: "brand",
  manual: "neutral",
  attended: "success",
  no_show: "danger",
} as const satisfies Record<string, ChipTone>;

// B-03 (task 4.4): one appointment of the barber, without a price, a total
// or the customer's contact (the database does not send them). "Atendida"
// and "No asistió" once it started (decision B2); never cancel or move
// (decision B1: the barber asks the owner).
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
  const instant = now();
  const today = toBogotaDate(instant);
  const appointment = await loadBarberAppointment(token, id);

  if (!appointment) {
    // Not this barber's: B-05 if the link itself stopped working.
    const agenda = await loadBarberAgenda(token, today, today);
    if (!agenda) return <BarberLinkGone />;
    return (
      <div className="mx-auto flex w-full max-w-md flex-col">
        <TopBar
          title={t.cita.titulo}
          back={{ href: barberAgendaHref(token), label: t.cita.volver }}
        />
        <main className="px-5">
          <EmptyState title={t.errores.not_yours} />
        </main>
      </div>
    );
  }

  const date = toBogotaDate(appointment.start);
  const look = appointmentLook(appointment, instant);
  const refusal = refusalOf((await searchParams).aviso);
  const rows = [
    {
      term: t.cita.cuando,
      value: t.cita.cuandoLinea(
        dayLabel(date, today),
        timeRangeLabel(appointment.start, appointment.end),
      ),
    },
    {
      term: t.cita.servicios,
      value: appointment.services
        .map((service) => t.cita.servicio(service.name, service.minutes))
        .join(" + "),
    },
    {
      term: t.cita.visitas,
      value: t.cita.visitasLinea(appointment.visits, appointment.noShows),
    },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-md">
        <TopBar
          title={t.cita.titulo}
          back={{
            href: barberAgendaHref(token, {
              dia: date !== today ? date : undefined,
            }),
            label: t.cita.volver,
          }}
        />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pt-1 pb-4">
        {refusal ? <Notice tone="danger" title={t.errores[refusal]} /> : null}
        <div className="flex flex-col items-start gap-2">
          <Chip tone={LOOK_TONES[look]}>{a.estados[look]}</Chip>
          <h1 className="text-title">{appointment.customerName}</h1>
        </div>
        <dl className="border-line flex flex-col gap-3 rounded-[14px] border bg-white px-4 py-3.5">
          {rows.map((row) => (
            <div key={row.term} className="flex flex-col gap-0.5">
              <dt className="text-muted text-[13px]">{row.term}</dt>
              <dd className="text-[15px] font-bold">{row.value}</dd>
            </div>
          ))}
        </dl>
      </main>
      {canMark(appointment, instant) ? (
        <div className="sticky bottom-0 mx-auto w-full max-w-md">
          <ActionBar>
            <MarkButtons
              token={token}
              appointmentId={appointment.id}
              customerName={appointment.customerName}
              back="cita"
              size="bar"
            />
          </ActionBar>
        </div>
      ) : null}
    </div>
  );
}
