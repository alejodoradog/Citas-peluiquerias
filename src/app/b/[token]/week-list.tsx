import Link from "next/link";
import { formatWallClock } from "@/lib/fechas/fechas";
import { barberAgendaHref } from "@/lib/routes";
import type { BarberWeekDay } from "@/modulos/agenda/dominio/barber-agenda";
import { ChevronLeftIcon, ChevronRightIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import { weekDayLabel, weekTitle } from "./labels";

const t = textos.barbero;
const a = textos.agenda;

// "7:00 p. m.", and midnight as the end of the day.
function wall(time: string): string {
  return formatWallClock(time === "24:00" ? "00:00" : time);
}

// B-02: the week, Monday to Sunday, each day with the barber's hours (or
// "Descansas") and how many appointments it has. A day opens B-01 on it.
// The arrows go a week back or ahead within the days the barber can open
// (decision B5); the design has one week and no arrows.
export function WeekList({
  token,
  days,
  canOpen,
  previous,
  next,
}: {
  token: string;
  days: readonly BarberWeekDay[];
  canOpen: (date: string) => boolean;
  previous: string | null;
  next: string | null;
}) {
  const arrow =
    "text-ink flex size-11 items-center justify-center rounded-full no-underline";
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="semana">
      <div className="flex items-center gap-1">
        <h2 id="semana" className="flex-1 text-base font-bold">
          {weekTitle(days.map((day) => day.date))}
        </h2>
        {previous ? (
          <Link
            href={barberAgendaHref(token, { vista: "semana", dia: previous })}
            aria-label={a.anterior.semana}
            className={arrow}
          >
            <ChevronLeftIcon size={20} />
          </Link>
        ) : null}
        {next ? (
          <Link
            href={barberAgendaHref(token, { vista: "semana", dia: next })}
            aria-label={a.siguiente.semana}
            className={arrow}
          >
            <ChevronRightIcon size={20} />
          </Link>
        ) : null}
      </div>
      <ul className="border-line divide-line flex flex-col divide-y overflow-hidden rounded-[14px] border bg-white">
        {days.map((day) => {
          const content = (
            <>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">
                  {weekDayLabel(day.date)}
                </span>
                {day.hours ? (
                  <span className="text-muted text-[13px]">
                    {t.horario(wall(day.hours.start), wall(day.hours.end))}
                  </span>
                ) : null}
              </span>
              {day.hours || day.count > 0 ? (
                <span className="text-sm font-bold">{a.citas(day.count)}</span>
              ) : (
                <span className="text-muted text-sm font-semibold">
                  {t.descansas}
                </span>
              )}
            </>
          );
          const row = "text-ink flex min-h-14 items-center gap-3 px-4 py-3";
          return (
            <li key={day.date}>
              {/* A rest day without appointments has nothing to open, as
                  B-02 draws it: no chevron. */}
              {canOpen(day.date) && (day.hours || day.count > 0) ? (
                <Link
                  href={barberAgendaHref(token, { dia: day.date })}
                  className={`${row} no-underline`}
                >
                  {content}
                  <ChevronRightIcon size={18} />
                </Link>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
