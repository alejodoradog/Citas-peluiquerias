import type { ReactNode } from "react";
import {
  formatWallClock,
  now,
  toBogotaDate,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { loadBarberAgendaSpan } from "@/modulos/agenda/datos/barber-agenda";
import {
  blockDayOptions,
  blockTimeOptions,
  closedBlockDays,
} from "@/modulos/agenda/dominio/barber-agenda";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { BlockForm } from "./block-form";
import { agendaHref, type AgendaEntry } from "./entry";
import { dayLabel } from "./labels";

const t = textos.barbero;

// B-04 (task 4.4), by either entry: the professional blocks hours of their
// own, from now to 30 days ahead (decision B5), only where they have no
// appointment. A paused barbershop or an inactive professional cannot block.
export async function BlockScreen({
  entry,
  gone,
}: {
  entry: AgendaEntry;
  gone: ReactNode;
}) {
  const instant = now();
  const today = toBogotaDate(instant);
  // The whole window of the picker: its closed days are not offered.
  const days = blockDayOptions(today);
  const agenda = await loadBarberAgendaSpan(entry, today, days.at(-1)!);
  if (!agenda) return gone;

  const close = { href: agendaHref(entry), label: t.bloquear.cerrar };
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

  const closed = new Set(closedBlockDays(agenda, days));
  // From the next quarter hour, for an hour, while the day lasts.
  const quarter = 15 * 60_000;
  const next = new Date(Math.ceil(instant.getTime() / quarter) * quarter);
  const times = blockTimeOptions();
  const nextTime = toBogotaDate(next) === today ? toBogotaTime(next) : null;
  const fromIndex = nextTime ? times.indexOf(nextTime) : 36;
  const start = fromIndex >= 0 && fromIndex < times.length - 1 ? fromIndex : 36;

  return (
    <BlockForm
      entry={entry}
      close={close}
      days={days.map((date) => ({
        value: date,
        label: closed.has(date)
          ? t.bloquear.diaCerrado(dayLabel(date, today, "long"))
          : dayLabel(date, today, "long"),
        disabled: closed.has(date),
      }))}
      times={times.map((time) => ({
        value: time,
        label: formatWallClock(time),
      }))}
      defaults={{
        // Today, or the first day with something to block.
        dia: days.find((date) => !closed.has(date)) ?? today,
        desde: times[start]!,
        hasta: times[Math.min(start + 4, times.length - 1)]!,
      }}
    />
  );
}
