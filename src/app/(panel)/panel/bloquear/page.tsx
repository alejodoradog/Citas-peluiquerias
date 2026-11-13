import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  addDays,
  formatWallClock,
  isBogotaDate,
  now,
  toBogotaDate,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { loadOwnerAgenda } from "@/modulos/agenda/datos/owner-agenda";
import { shortCustomerName } from "@/modulos/agenda/dominio/owner-agenda";
import {
  blockDayOptions,
  blockTimeOptions,
  DAYS_AHEAD,
} from "@/modulos/agenda/dominio/barber-agenda";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { dayTitle } from "../agenda-labels";
import { requireReadyOwner } from "../ready-owner";
import { OwnerBlockForm } from "./block-form";

const t = textos.agenda.bloquear;

export const metadata: Metadata = { title: t.titulo };

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

// D-39 (task 4.2): one barber or the whole barbershop, a day up to 30 days
// ahead, from and until (quarter hours) and the reason. D-38 brings
// ?barbero, ?dia and ?desde from what it had chosen.
export default function BlockPage({
  searchParams,
}: PageProps<"/panel/bloquear">) {
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
      <Block searchParams={searchParams} />
    </Suspense>
  );
}

async function Block({
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
  const today = toBogotaDate(instant);
  const agenda = await loadOwnerAgenda(
    barbershop.id,
    today,
    addDays(today, DAYS_AHEAD),
  );
  const barbers = agenda.barbers.filter((barber) => barber.active);
  const times = blockTimeOptions();

  // From what D-38 had, or from the next quarter hour, for an hour.
  const quarter = 15 * 60_000;
  const next = new Date(Math.ceil(instant.getTime() / quarter) * quarter);
  const wantedDay = first(query.dia);
  const dia =
    isBogotaDate(wantedDay) &&
    wantedDay >= today &&
    wantedDay <= addDays(today, DAYS_AHEAD)
      ? wantedDay
      : today;
  const wantedTime = first(query.desde);
  const nextTime = toBogotaDate(next) === dia ? toBogotaTime(next) : null;
  const fromIndex = times.includes(wantedTime)
    ? times.indexOf(wantedTime)
    : nextTime
      ? times.indexOf(nextTime)
      : 36;
  const start = fromIndex >= 0 && fromIndex < times.length - 1 ? fromIndex : 36;
  const wantedBarber = first(query.barbero);

  return (
    <OwnerBlockForm
      barbers={barbers.map((barber) => ({ id: barber.id, name: barber.name }))}
      days={blockDayOptions(today).map((date) => ({
        value: date,
        label: dayTitle(date, today),
      }))}
      times={times.map((time) => ({
        value: time,
        label: formatWallClock(time),
      }))}
      appointments={agenda.appointments.map((a) => ({
        barberId: a.barberId,
        start: a.start,
        end: a.end,
        // The warning shows "Mateo R.": the short name is all that leaves.
        customerName: shortCustomerName(a.customerName),
      }))}
      defaults={{
        // A barber by default: closing the whole barbershop is a choice.
        quien: barbers.some((b) => b.id === wantedBarber)
          ? wantedBarber
          : (barbers[0]?.id ?? ""),
        dia,
        desde: times[start]!,
        hasta: times[Math.min(start + 4, times.length - 1)]!,
      }}
    />
  );
}
