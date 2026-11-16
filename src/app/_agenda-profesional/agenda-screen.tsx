import Link from "next/link";
import type { ReactNode } from "react";
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
import { SignOutButton } from "@/ui/sign-out-button";
import { textos } from "@/ui/textos";
import { AccessGone } from "./access-gone";
import { BarberHeader } from "./barber-header";
import { DayList } from "./day-list";
import { dayLabel, timeLabel } from "./labels";
import { refusalOf } from "./refusal";
import { WeekList } from "./week-list";

const t = textos.barbero;

type Search = Record<string, string | string[] | undefined>;

// B-01 and B-02 (task 4.4), by the professional's session (task 7.6b): the
// day or the week, with today's summary, the paused notice (B-06), "Bloquear
// horas", "Cerrar sesión" and the link to share (`share`). AccessGone when
// the session no longer reaches an agenda.
export async function AgendaScreen({
  search,
  share,
}: {
  search: Search;
  share?: ReactNode;
}) {
  const instant = now();
  const today = toBogotaDate(instant);
  const query = parseBarberQuery(search, today);
  const days = query.view === "semana" ? weekOf(query.date) : [query.date];
  const from = days[0]!;
  const until = days.at(-1)!;

  // The summary is always of today. When the days shown leave today out,
  // today is read too, at the same time: it depends on the session only.
  const [data, todays] =
    from <= today && today <= until
      ? await loadBarberAgenda(from, until).then(
          (agenda) => [agenda, agenda] as const,
        )
      : await Promise.all([
          loadBarberAgenda(from, until),
          loadBarberAgenda(today, today),
        ]);
  if (!data || !todays) return <AccessGone />;

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
        end={<SignOutButton />}
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
              date={query.date}
              items={dayItems(data, query.date, instant)}
            />
            {writable && data.barber.active ? (
              <Link
                href={routes.myBlock}
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                <LockIcon size={18} />
                {t.bloquearHoras}
              </Link>
            ) : null}
            {share}
            <p className="text-muted text-center text-[13px]">
              {textos.miAgenda.soloTuya}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
