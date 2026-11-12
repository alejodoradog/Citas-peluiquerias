import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import {
  addDays,
  formatBogotaDate,
  now,
  startOfBogotaDay,
  toBogotaDate,
} from "@/lib/fechas/fechas";
import { newAppointmentHref, routes } from "@/lib/routes";
import {
  hasAnyAppointment,
  loadOwnerAgenda,
} from "@/modulos/agenda/datos/owner-agenda";
import {
  barberDay,
  gridHours,
  parseAgendaQuery,
  shownBarbers,
  weekOf,
  weekSummary,
  type AgendaItem,
} from "@/modulos/agenda/dominio/owner-agenda";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import { requireOwner } from "@/modulos/cuentas/guards";
import { BottomNav } from "@/ui/bottom-nav";
import { removeOwnerBlock } from "@/modulos/agenda/acciones/owner-appointment";
import { Fab } from "@/ui/fab";
import { Notice } from "@/ui/notice";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import {
  AgendaHeader,
  BarberChips,
  DayArrows,
  placeHref,
  type AgendaPlace,
  type HeaderBarber,
} from "./agenda-header";
import { dayTitle, weekTitle } from "./agenda-labels";
import { BarberDayList } from "./barber-day-list";
import { DayGrid } from "./day-grid";
import { EmptyAgenda } from "./empty-agenda";
import { DeletedBarbershopNotice } from "./sedes/deleted-notice";
import { WeekDays } from "./week-days";

const t = textos.agenda;

export const metadata: Metadata = { title: textos.ui.navegacion.agenda };

// The owner's home (task 4.1): the agenda of the active sede. D-30 by day
// with a column per barber, D-31 one barber's day, D-32 the week and D-33
// until the first appointment. The query says what it shows (decision A6).
export default function PanelPage({ searchParams }: PageProps<"/panel">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-28">
        <Suspense
          fallback={
            <div className="px-4 pt-5">
              <LoadingState label={t.cargando} />
            </div>
          }
        >
          <OwnerAgenda searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

async function OwnerAgenda({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireOwner(),
  ]);
  // A barbershop without services has not finished the wizard (task 2.1).
  if (await barbershopNeedsSetup(barbershop.id)) {
    redirect(routes.setup);
  }
  await connection();
  const current = now();
  const today = toBogotaDate(current);
  const { view, date, barberId: asked } = parseAgendaQuery(query, today);
  const range = view === "semana" ? weekOf(date) : [date];
  const data = await loadOwnerAgenda(barbershop.id, range[0]!, range.at(-1)!);
  const barbers = shownBarbers(data.barbers, data.appointments);
  // A barber who is not in the agenda (another sede's, or gone) shows all.
  const barber = barbers.find((b) => b.id === asked) ?? null;
  const place: AgendaPlace = {
    view,
    date,
    today,
    barberId: barber?.id ?? null,
  };
  const headerBarbers: HeaderBarber[] = barbers.map(({ id, name }) => ({
    id,
    name,
  }));
  const trialEnd = formatBogotaDate(startOfBogotaDay(barbershop.expiresOn));
  const notices = (
    <div className="flex flex-col gap-2.5 px-4 pb-3">
      {/* After "Eliminar sede" (task 2.6b), which sede went away. */}
      <DeletedBarbershopNotice />
      <Notice tone="info" title={textos.panel.prueba(trialEnd)} />
    </div>
  );
  const fab = (
    <Fab
      href={newAppointmentHref({
        barbero: barber?.id,
        dia: date === today ? undefined : date,
      })}
      label={textos.ui.nuevaCita}
    />
  );

  if (view === "semana") {
    const days = weekSummary(range, barber ? [barber] : barbers, data);
    const total = days.reduce((sum, day) => sum + day.count, 0);
    return (
      <>
        <AgendaHeader
          shopName={barbershop.name}
          title={weekTitle(range)}
          place={place}
          previous={addDays(date, -7)}
          next={addDays(date, 7)}
          showToday={!range.includes(today)}
          barbers={headerBarbers}
          summary={t.resumen(t.citas(total), t.ayudaEspacio)}
        />
        {notices}
        <NoBarbers show={barbers.length === 0} />
        <WeekDays
          days={days}
          today={today}
          dayHref={(day) => placeHref(place, { view: "dia", date: day })}
          byBarber={barber === null}
        />
        {fab}
      </>
    );
  }

  const columns = (barber ? [barber] : barbers).map((b) =>
    barberDay(date, b, data, current),
  );
  const count = columns
    .flatMap((column) => column.items)
    .filter((item: AgendaItem) => item.kind === "appointment").length;
  const title = dayTitle(date, today);
  const arrows = {
    place,
    previous: addDays(date, -1),
    next: addDays(date, 1),
    showToday: date !== today,
  };

  if (barber) {
    const [column] = columns;
    return (
      <>
        <TopBar
          title={t.barberos.agendaDe(barber.name)}
          subtitle={`${title} · ${t.citas(count)}`}
          titleAs="h1"
          back={{
            href: placeHref(place, { barberId: null }),
            label: textos.ui.volver,
          }}
          action={<DayArrows {...arrows} />}
        />
        <BarberChips place={place} barbers={headerBarbers} />
        {notices}
        {column!.items.length > 0 ? (
          <BarberDayList
            day={column!}
            date={date}
            removeBlock={removeOwnerBlock}
          />
        ) : (
          <Padded>
            <EmptyState title={t.sinCitas}>
              {column!.working.length === 0 ? t.diaCerrado : null}
            </EmptyState>
          </Padded>
        )}
        {fab}
      </>
    );
  }

  const firstOne = count === 0 && !(await hasAnyAppointment(barbershop.id));
  const hours = gridHours(date, columns);
  return (
    <>
      <AgendaHeader
        shopName={barbershop.name}
        title={title}
        {...arrows}
        barbers={headerBarbers}
        summary={
          firstOne
            ? date === today
              ? t.sinCitasHoy
              : t.sinCitas
            : t.resumen(count > 0 ? t.citas(count) : t.sinCitas, t.ayudaEspacio)
        }
      />
      {notices}
      <NoBarbers show={barbers.length === 0} />
      {firstOne ? (
        <EmptyAgenda
          newAppointment={newAppointmentHref({
            dia: date === today ? undefined : date,
          })}
        />
      ) : hours ? (
        <DayGrid
          date={date}
          days={columns}
          hours={hours}
          now={current}
          barberHref={(id) => placeHref(place, { barberId: id })}
          removeBlock={removeOwnerBlock}
        />
      ) : (
        <Padded>
          <EmptyState title={t.cerrado}>{t.diaCerrado}</EmptyState>
        </Padded>
      )}
      {fab}
    </>
  );
}

function Padded({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-4">{children}</div>;
}

function NoBarbers({ show }: { show: boolean }) {
  return show ? (
    <Padded>
      <Notice tone="warning" title={t.sinBarberos} />
    </Padded>
  ) : null;
}
