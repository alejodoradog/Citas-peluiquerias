import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  deleteCustomer,
  saveCustomerNotes,
} from "@/modulos/clientes/acciones/customers";
import { getCustomerProfile } from "@/modulos/clientes/datos/customers";
import {
  displayPhone,
  showsNoShowAlert,
  sortHistory,
  summarizeHistory,
  type AppointmentStatus,
  type HistoryEntry,
} from "@/modulos/clientes/dominio/customers";
import { Avatar } from "@/ui/avatar";
import { BottomNav } from "@/ui/bottom-nav";
import { ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { Chip, type ChipTone } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { PlusIcon, WarningIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../ready-owner";
import { customerSince, noShowSentence, shortDay, timeOf } from "../format";
import { DeleteCustomer } from "./delete-customer";
import { NotesForm } from "./notes-form";

const t = textos.clientes.ficha;

export const metadata: Metadata = { title: t.titulo };

// D-41 (task 4.3): one customer of the barbershop, with their visits,
// no-shows and what they spent, their contact, the barbershop's notes and
// every appointment. The id comes from the URL: one that is not an id, a
// customer of another barbershop or a deleted one is "not found".
export default function CustomerPage({
  params,
}: PageProps<"/panel/clientes/[id]">) {
  return (
    <Suspense
      fallback={
        <Frame>
          <LoadingState label={t.cargando} />
        </Frame>
      }
    >
      <Customer params={params} />
    </Suspense>
  );
}

// The top bar of D-41 (back to the list and, once loaded, the trash icon of
// D-42), the column and the bottom bar of the panel.
function Frame({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-md">
        <TopBar
          title={t.titulo}
          back={{ href: routes.panelClients, label: textos.ui.volver }}
          action={action}
        />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pt-1 pb-28">
        {children}
      </main>
      {/* The bar reads the pathname, which a route with an [id] only knows
          at request time: it waits in its own boundary, also while this
          frame is the page's loading state. */}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

const statusTones: Record<AppointmentStatus, ChipTone> = {
  confirmed: "brand",
  attended: "success",
  no_show: "danger",
  cancelled_by_customer: "neutral",
  cancelled_by_barbershop: "neutral",
};

async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const customer = await getCustomerProfile(barbershop.id, id);
  if (!customer) notFound();
  // Always live: "hoy" runs with the clock.
  await connection();
  const instant = now();
  const summary = summarizeHistory(customer.history);
  const history = sortHistory(customer.history);

  return (
    <Frame
      action={
        <DeleteCustomer
          customerId={customer.id}
          name={customer.fullName}
          action={deleteCustomer}
        />
      }
    >
      <div className="flex items-center gap-3.5">
        <Avatar name={customer.fullName} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[1.375rem] leading-tight font-bold break-words">
            {customer.fullName}
          </h1>
          <p className="text-help text-muted">
            {customerSince(customer.createdAt)}
          </p>
        </div>
      </div>

      {showsNoShowAlert(summary.noShows) ? (
        <NoShowAlert
          title={textos.clientes.inasistencias(summary.noShows)}
          body={noShowSentence(summary.noShowDays, instant)}
        />
      ) : null}

      <dl className="grid grid-cols-3 gap-2.5">
        <Stat label={t.numeros.visitas} value={String(summary.visits)} />
        <Stat
          label={t.numeros.inasistencias}
          value={String(summary.noShows)}
          alert={summary.noShows > 0}
        />
        <Stat
          label={t.numeros.total}
          value={formatPesos(summary.totalSpentCop)}
        />
      </dl>

      <Card className="gap-2.5">
        <dl className="flex flex-col gap-2.5">
          <Contact
            label={t.correo}
            value={customer.email}
            empty={t.sinCorreo}
          />
          <Contact
            label={t.celular}
            value={customer.phone ? displayPhone(customer.phone) : null}
            empty={t.sinCelular}
          />
        </dl>
      </Card>

      <NotesForm
        customerId={customer.id}
        notes={customer.notes}
        action={saveCustomerNotes}
      />

      <h2 className="text-label text-muted">{t.historial}</h2>
      {history.length > 0 ? (
        <List>
          {history.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} now={instant} />
          ))}
        </List>
      ) : (
        <p className="text-body text-muted">{t.sinCitas}</p>
      )}

      {/* routes.newAppointment (task 4.1/4.2): D-38 "Nueva cita", with the
          customer chosen. */}
      <ButtonLink
        href={`/panel/citas/nueva?cliente=${customer.id}`}
        variant="secondary"
        size="md"
      >
        <PlusIcon size={18} />
        {t.nuevaCita(customer.fullName)}
      </ButtonLink>
    </Frame>
  );
}

// The alert of D-41 (spec, "Inasistencias": 2 or more). A status, not an
// alarm: it is there from the start, so it waits its turn.
function NoShowAlert({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="status"
      className="rounded-button bg-danger-soft flex items-start gap-2.5 px-3.5 py-3"
    >
      <span className="text-danger flex pt-px">
        <WarningIcon />
      </span>
      <div className="flex flex-col gap-1">
        <strong className="text-label text-danger font-bold">{title}</strong>
        <span className="text-help text-ink">{body}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-button border-line flex min-w-0 flex-col-reverse gap-0.5 border bg-white p-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd
        className={cx(
          "text-[1.375rem] leading-tight font-bold break-words",
          alert ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Contact({
  label,
  value,
  empty,
}: {
  label: string;
  value: string | null;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-help text-muted">{label}</dt>
      <dd
        className={cx(
          "text-body break-words",
          value ? "font-semibold" : "text-muted",
        )}
      >
        {value ?? empty}
      </dd>
    </div>
  );
}

function HistoryRow({
  entry,
  now: instant,
}: {
  entry: HistoryEntry;
  now: Date;
}) {
  return (
    <ListRow
      title={t.cita(shortDay(entry.startsAt, instant), timeOf(entry.startsAt))}
      subtitle={t.detalle(entry.services.join(" + "), entry.barber)}
      trailing={
        <Chip tone={statusTones[entry.status]}>{t.estados[entry.status]}</Chip>
      }
    />
  );
}
