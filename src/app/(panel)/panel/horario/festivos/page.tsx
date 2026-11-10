import type { Metadata } from "next";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { SAVED_PARAM, routes } from "@/lib/routes";
import {
  addClosure,
  removeClosure,
  saveHolidayOpenings,
} from "@/modulos/barberias/acciones/holidays";
import {
  getHolidayOpenings,
  listUpcomingClosures,
} from "@/modulos/barberias/datos/holidays";
import {
  holidayWindow,
  upcomingHolidays,
} from "@/modulos/barberias/dominio/holidays";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../../ready-owner";
import { closureTitle } from "./closure-text";
import { HolidaysEditor } from "./holidays-editor";

const t = textos.festivos;

export const metadata: Metadata = { title: t.titulo };

// D-59, Horario › Festivos y cierres. "?guardado=1" is where "Guardar" sends
// the owner back to.
export default function HolidaysPage({
  searchParams,
}: PageProps<"/panel/horario/festivos">) {
  return (
    <Suspense fallback={<HolidaysLoading />}>
      <Holidays searchParams={searchParams} />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the holidays load.
function HolidaysLoading() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelShopHours, label: textos.ui.volver }}
        />
      }
    >
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function Holidays({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireReadyOwner(),
  ]);
  const instant = now();
  const today = toBogotaDate(instant);
  const window = holidayWindow(today);
  const [opened, closures] = await Promise.all([
    getHolidayOpenings(barbershop.id, window),
    listUpcomingClosures(barbershop.id, instant),
  ]);

  // Keyed by what is saved, so the switches start from it when Next.js
  // refreshes the page after "Guardar"; adding or removing a closure keeps
  // the switches the owner has not saved yet.
  return (
    <HolidaysEditor
      key={opened.join(",")}
      action={saveHolidayOpenings}
      addAction={addClosure}
      removeAction={removeClosure}
      holidays={upcomingHolidays(window.from, window.until)}
      opened={opened}
      closures={closures.map((closure) => ({
        id: closure.id,
        title: closureTitle(closure.startsAt, closure.endsAt),
        reason: closure.reason,
      }))}
      today={today}
      saved={query[SAVED_PARAM] === "1"}
    />
  );
}
