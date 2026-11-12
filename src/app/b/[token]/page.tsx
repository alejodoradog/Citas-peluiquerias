import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { addDays, now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { loadBarberAgenda } from "@/modulos/agenda/datos/barber-agenda";
import {
  DAYS_AHEAD,
  DAYS_BACK,
  dayItems,
  parseBarberQuery,
  todaySummary,
  weekDays,
} from "@/modulos/agenda/dominio/barber-agenda";
import { weekOf } from "@/modulos/agenda/dominio/owner-agenda";
import { buttonClasses } from "@/ui/button";
import { LockIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { BarberHeader } from "./barber-header";
import { DayList } from "./day-list";
import { dayLabel, timeLabel } from "./labels";
import { BarberLinkGone } from "./link-gone";
import { refusalOf } from "./refusal";
import { WeekList } from "./week-list";

const t = textos.barbero;

// The link is a credential: no search engine keeps it, and no page it opens
// learns it from the Referer (next.config.ts also sends no-store).
export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-01 and B-02 (task 4.4): "Mi agenda" of a barber, from their private
// link; B-05 when the link no longer works and B-06 when the barbershop is
// paused. The token is the whole credential; only its hash reaches the
// database.
export default function BarberAgendaPage({
  params,
  searchParams,
}: PageProps<"/b/[token]">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BarberAgenda params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BarberAgenda({
  params,
  searchParams,
}: Pick<PageProps<"/b/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  // Always live: a booking can arrive at any moment.
  await connection();
  const instant = now();
  const today = toBogotaDate(instant);
  const search = await searchParams;
  const query = parseBarberQuery(search, today);
  const days = query.view === "semana" ? weekOf(query.date) : [query.date];
  const from = days[0]!;
  const until = days.at(-1)!;

  const data = await loadBarberAgenda(token, from, until);
  const todays =
    data && from <= today && today <= until
      ? data
      : await loadBarberAgenda(token, today, today);
  if (!data || !todays) return <BarberLinkGone />;

  const summary = todaySummary(todays, today, instant);
  const counted =
    summary.count === 0 ? t.resumen.sinCitas : t.resumen.citas(summary.count);
  const refusal = refusalOf(search.aviso);
  const firstDay = addDays(today, -DAYS_BACK);
  const lastDay = addDays(today, DAYS_AHEAD);
  const canOpen = (date: string) => date >= firstDay && date <= lastDay;
  const writable = data.barbershop.writable;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <BarberHeader
        token={token}
        barbershopName={data.barbershop.name}
        barberName={data.barber.name}
        summary={
          summary.next
            ? t.resumen.proxima(counted, timeLabel(summary.next))
            : counted
        }
        writable={writable}
        view={query.view}
        onToday={query.date === today}
      />
      <main className="flex flex-col gap-2.5 px-5 pb-5">
        {refusal ? <Notice tone="danger" title={t.errores[refusal]} /> : null}
        {query.view === "semana" ? (
          <WeekList
            token={token}
            days={weekDays(data, days)}
            canOpen={canOpen}
            previous={canOpen(addDays(from, -1)) ? addDays(from, -7) : null}
            next={canOpen(addDays(until, 1)) ? addDays(from, 7) : null}
          />
        ) : (
          <>
            {query.date !== today ? (
              <h2 className="text-base font-bold">
                {dayLabel(query.date, today)}
              </h2>
            ) : null}
            <DayList
              token={token}
              date={query.date}
              items={dayItems(data, query.date, instant)}
            />
            {writable && data.barber.active ? (
              <Link
                href={routes.barberBlock(token)}
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                <LockIcon size={18} />
                {t.bloquearHoras}
              </Link>
            ) : null}
            <p className="text-muted text-center text-[13px]">{t.soloTuyo}</p>
          </>
        )}
      </main>
    </div>
  );
}
