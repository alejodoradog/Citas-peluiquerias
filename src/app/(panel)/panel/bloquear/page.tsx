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
import { findOwnerBarber } from "@/modulos/agenda/datos/owner-appointment";
import { shortCustomerName } from "@/modulos/agenda/dominio/owner-agenda";
import {
  ownerClosedBlockDays,
  type BlockTargetKind,
} from "@/modulos/agenda/dominio/owner-block";
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

// D-39 (task 4.2) and task 8.14: the owner's own agenda, another
// professional or the whole establishment, a day up to 30 days ahead, the
// whole day or from and until (quarter hours), and the reason. D-38 brings
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
  const dates = blockDayOptions(today);
  const [agenda, ownerRow] = await Promise.all([
    loadOwnerAgenda(barbershop.id, today, addDays(today, DAYS_AHEAD)),
    findOwnerBarber(barbershop.id),
  ]);
  // Task 8.14: the owner who attends blocks "Mi agenda"; the others are the
  // active professionals but them.
  const owner =
    agenda.barbers.find((barber) => barber.id === ownerRow?.id) ?? null;
  const barbers = agenda.barbers.filter(
    (barber) => barber.active && barber.id !== owner?.id,
  );
  const times = blockTimeOptions();

  // From what D-38 had, or from the next quarter hour, for an hour.
  const quarter = 15 * 60_000;
  const next = new Date(Math.ceil(instant.getTime() / quarter) * quarter);
  const wantedDay = first(query.dia);
  const wanted =
    isBogotaDate(wantedDay) &&
    wantedDay >= today &&
    wantedDay <= addDays(today, DAYS_AHEAD)
      ? wantedDay
      : today;
  const wantedBarber = first(query.barbero);
  // "Mi agenda" first; D-38 may bring another professional.
  const otherWanted = barbers.find((b) => b.id === wantedBarber);
  const para: BlockTargetKind = otherWanted
    ? "barber"
    : owner
      ? "mine"
      : barbers.length > 0
        ? "barber"
        : "shop";
  const profesional = otherWanted?.id ?? barbers[0]?.id ?? "";
  const closed = {
    mine: owner ? ownerClosedBlockDays(agenda, owner, dates) : [],
    barbers: Object.fromEntries(
      barbers.map((barber) => [
        barber.id,
        ownerClosedBlockDays(agenda, barber, dates),
      ]),
    ),
    shop: ownerClosedBlockDays(agenda, null, dates),
  };
  // The day wanted, or the first one with something to block.
  const shut = new Set<string>(
    para === "mine"
      ? closed.mine
      : para === "barber"
        ? (closed.barbers[profesional] ?? [])
        : closed.shop,
  );
  const dia = shut.has(wanted)
    ? (dates.find((date) => !shut.has(date)) ?? wanted)
    : wanted;
  const wantedTime = first(query.desde);
  const nextTime = toBogotaDate(next) === dia ? toBogotaTime(next) : null;
  const fromIndex = times.includes(wantedTime)
    ? times.indexOf(wantedTime)
    : nextTime
      ? times.indexOf(nextTime)
      : 36;
  const start = fromIndex >= 0 && fromIndex < times.length - 1 ? fromIndex : 36;

  return (
    <OwnerBlockForm
      owner={owner ? { id: owner.id, name: owner.name } : null}
      barbers={barbers.map((barber) => ({ id: barber.id, name: barber.name }))}
      days={dates.map((date) => ({
        value: date,
        label: dayTitle(date, today),
      }))}
      closed={closed}
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
      today={today}
      now={instant}
      defaults={{
        para,
        profesional,
        dia,
        desde: times[start]!,
        hasta: times[Math.min(start + 4, times.length - 1)]!,
      }}
    />
  );
}
