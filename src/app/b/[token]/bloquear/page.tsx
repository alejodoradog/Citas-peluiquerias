import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  formatWallClock,
  now,
  toBogotaDate,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { barberAgendaHref } from "@/lib/routes";
import { loadBarberAgenda } from "@/modulos/agenda/datos/barber-agenda";
import {
  blockDayOptions,
  blockTimeOptions,
} from "@/modulos/agenda/dominio/barber-agenda";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { dayLabel } from "../labels";
import { BarberLinkGone } from "../link-gone";
import { BlockForm } from "./block-form";

const t = textos.barbero;

export const metadata: Metadata = {
  title: t.bloquear.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-04 (task 4.4): the barber blocks hours of their own, from now to 30 days
// ahead (decision B5), only where they have no appointment. A paused
// barbershop or an inactive barber cannot block.
export default function BarberBlockPage({
  params,
}: PageProps<"/b/[token]/bloquear">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BarberBlock params={params} />
    </Suspense>
  );
}

async function BarberBlock({
  params,
}: Pick<PageProps<"/b/[token]/bloquear">, "params">) {
  const { token } = await params;
  await connection();
  const instant = now();
  const today = toBogotaDate(instant);
  const agenda = await loadBarberAgenda(token, today, today);
  if (!agenda) return <BarberLinkGone />;

  const close = { href: barberAgendaHref(token), label: t.bloquear.cerrar };
  if (!agenda.barbershop.writable || !agenda.barber.active) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col">
        <TopBar title={t.bloquear.titulo} titleAs="h1" close={close} />
        <main className="px-5">
          {agenda.barbershop.writable ? (
            <Notice tone="warning" title={t.errores.barber_inactive} />
          ) : (
            <Notice tone="warning" title={t.pausada.titulo}>
              {t.pausada.detalle}
            </Notice>
          )}
        </main>
      </div>
    );
  }

  // From the next quarter hour, for an hour, while the day lasts.
  const quarter = 15 * 60_000;
  const next = new Date(Math.ceil(instant.getTime() / quarter) * quarter);
  const times = blockTimeOptions();
  const nextTime = toBogotaDate(next) === today ? toBogotaTime(next) : null;
  const fromIndex = nextTime ? times.indexOf(nextTime) : 36;
  const start = fromIndex >= 0 && fromIndex < times.length - 1 ? fromIndex : 36;

  return (
    <BlockForm
      token={token}
      close={close}
      days={blockDayOptions(today).map((date) => ({
        value: date,
        label: dayLabel(date, today, "long"),
      }))}
      times={times.map((time) => ({
        value: time,
        label: formatWallClock(time),
      }))}
      defaults={{
        dia: today,
        desde: times[start]!,
        hasta: times[Math.min(start + 4, times.length - 1)]!,
      }}
    />
  );
}
