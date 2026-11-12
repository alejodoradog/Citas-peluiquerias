import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { agendaHref, routes } from "@/lib/routes";
import {
  getOwnerAppointment,
  loadBarberServices,
} from "@/modulos/agenda/datos/owner-appointment";
import { appointmentLook } from "@/modulos/agenda/dominio/owner-agenda";
import {
  appointmentActions,
  DONE_PARAM,
  parseDone,
} from "@/modulos/agenda/dominio/owner-slots";
import { displayPhone } from "@/modulos/clientes/dominio/customers";
import { Card } from "@/ui/card";
import { Chip, type ChipTone } from "@/ui/chip";
import { FlowShell } from "@/ui/flow-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../ready-owner";
import { agoLabel, shortWhen, whenLabel } from "../labels";
import {
  AppointmentActionBar,
  EditServicesButton,
} from "./appointment-actions";

const t = textos.agenda.detalleCita;

export const metadata: Metadata = { title: textos.agenda.detalle };

// D-34 (task 4.2): one appointment of the active barbershop, with what the
// owner can do with it (D-35 to D-37 and "Editar servicios"). The id comes
// from the URL: one that is not an id, or of another barbershop, is "not
// found". ?hecho= says what the last action changed.
export default function AppointmentPage({
  params,
  searchParams,
}: PageProps<"/panel/citas/[id]">) {
  return (
    <Suspense
      fallback={
        <FlowShell header={<Header />}>
          <LoadingState label={t.cargando} />
        </FlowShell>
      }
    >
      <Appointment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function Header({
  back = routes.panel,
  action,
}: {
  back?: string;
  action?: ReactNode;
}) {
  return (
    <TopBar
      title={t.titulo}
      back={{ href: back, label: textos.ui.volver }}
      action={action}
    />
  );
}

const statusChip: Record<
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop",
  { tone: ChipTone; text: string }
> = {
  confirmed: { tone: "brand", text: textos.agenda.estados.confirmed },
  attended: { tone: "success", text: textos.agenda.estados.attended },
  no_show: { tone: "danger", text: textos.agenda.estados.no_show },
  cancelled_by_customer: { tone: "neutral", text: t.chips.canceladaCliente },
  cancelled_by_barbershop: { tone: "neutral", text: t.chips.canceladaBarberia },
};

async function Appointment({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query, { barbershop }] = await Promise.all([
    params,
    searchParams,
    requireReadyOwner(),
  ]);
  const appointment = await getOwnerAppointment(barbershop.id, id);
  if (!appointment) notFound();
  // Always live: what the owner may do depends on the clock.
  await connection();
  const instant = now();
  const today = toBogotaDate(instant);
  const actions = appointmentActions(appointment, instant);
  // What the barber offers today, plus what the appointment already has
  // (kept with its own price and length, even if deactivated since, M11).
  const offered = actions.editServices
    ? await loadBarberServices(barbershop.id, appointment.barber.id)
    : [];
  const options = [
    ...appointment.services,
    ...offered.filter((s) => !appointment.services.some((c) => c.id === s.id)),
  ];
  const done = parseDone(query[DONE_PARAM]);
  const back = agendaHref({
    dia:
      toBogotaDate(appointment.start) === today
        ? undefined
        : toBogotaDate(appointment.start),
  });

  const isNew =
    appointment.status === "confirmed" &&
    appointmentLook(appointment, instant) === "new";
  const chip = statusChip[appointment.status];
  const customer = appointment.customer;
  const when = shortWhen(appointment.start, today);

  return (
    <FlowShell
      header={
        <Header
          back={back}
          action={
            actions.editServices ? (
              <EditServicesButton
                appointmentId={appointment.id}
                options={options}
                chosen={appointment.services}
              />
            ) : undefined
          }
        />
      }
      actions={
        actions.mark || actions.cancel ? (
          <AppointmentActionBar
            appointmentId={appointment.id}
            customerName={customer.name}
            when={when}
            actions={actions}
          />
        ) : undefined
      }
    >
      {done ? <Notice tone="success" title={t.hechos[done]} /> : null}
      <div className="flex flex-wrap gap-2">
        {isNew ? <Chip tone="warning">{textos.agenda.estados.new}</Chip> : null}
        <Chip tone={chip.tone}>{chip.text}</Chip>
        <span className="text-muted self-center text-xs">
          {t.origenCuando(
            t.origen[appointment.source],
            agoLabel(appointment.createdAt, instant, today),
          )}
        </span>
      </div>
      <h1 className="text-[1.625rem] leading-[1.15] font-bold break-words">
        {customer.name}
      </h1>

      <Card>
        <dl className="flex flex-col gap-3">
          <Detail label={t.cuando}>
            {whenLabel(appointment.start, appointment.end, today)}
          </Detail>
          <Detail label={t.servicios}>
            {appointment.services
              .map((s) => t.servicio(s.name, s.durationMinutes))
              .join(" + ")}
          </Detail>
          <Detail label={t.barbero}>{appointment.barber.name}</Detail>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted text-body">{t.valor}</dt>
            <dd className="text-[1.0625rem] font-bold whitespace-nowrap">
              {formatPesos(appointment.priceCop)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="gap-2.5">
        {customer.anonymized ? (
          <strong className="text-body">{t.cliente}</strong>
        ) : (
          <Link
            href={routes.panelClient(customer.id)}
            className="text-ink flex min-h-11 items-center justify-between no-underline"
          >
            <strong className="text-body">{t.cliente}</strong>
            <span className="text-brand-strong text-sm font-bold">
              {t.verFicha}
            </span>
          </Link>
        )}
        <dl className="flex flex-col gap-2.5">
          <Detail label={t.correo} muted={!customer.email}>
            {customer.email ?? t.sinCorreo}
          </Detail>
          <Detail label={t.celular} muted={!customer.phone}>
            {customer.phone ? displayPhone(customer.phone) : t.sinCelular}
          </Detail>
        </dl>
        <p className="text-help text-muted">
          {t.historial(customer.visits, customer.noShows)}
        </p>
      </Card>
    </FlowShell>
  );
}

function Detail({
  label,
  muted = false,
  children,
}: {
  label: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-help text-muted">{label}</dt>
      <dd
        className={
          muted
            ? "text-body text-muted"
            : "text-body leading-[1.4] font-semibold break-words"
        }
      >
        {children}
      </dd>
    </div>
  );
}
