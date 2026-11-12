import Link from "next/link";
import type { WeekDaySummary } from "@/modulos/agenda/dominio/owner-agenda";
import { cx } from "@/ui/cx";
import { textos } from "@/ui/textos";
import { weekDayLabel } from "./agenda-labels";

const t = textos.agenda;

// D-32: the seven days of the week, each a link to its day, with how many
// appointments it has, how full it is and, for every barber, how many each.
export function WeekDays({
  days,
  today,
  dayHref,
  byBarber,
}: {
  days: readonly WeekDaySummary[];
  today: string;
  dayHref: (date: string) => string;
  // False when the agenda shows one barber: the line would repeat the count.
  byBarber: boolean;
}) {
  return (
    <ul className="border-line rounded-card mx-4 mb-4 flex flex-col overflow-hidden border bg-white">
      {days.map((day) => {
        const percent = Math.round(day.occupancy * 100);
        return (
          <li
            key={day.date}
            className="border-neutral-soft border-b last:border-b-0"
          >
            <Link
              href={dayHref(day.date)}
              aria-current={day.date === today ? "date" : undefined}
              className={cx(
                "text-ink flex flex-col gap-2 px-4 py-3.5 no-underline",
                day.date === today ? "bg-brand-soft/30" : "bg-white",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-bold">
                  {weekDayLabel(day.date, today)}
                </span>
                <span className="text-muted text-sm">
                  {day.closed ? t.cerrado : t.citas(day.count)}
                </span>
              </span>
              {day.closed ? null : (
                <>
                  <span
                    role="img"
                    aria-label={t.ocupacion(percent)}
                    className="bg-neutral-soft block h-2 overflow-hidden rounded-sm"
                  >
                    <span
                      className="bg-brand block h-2"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  {byBarber && day.perBarber.length > 0 ? (
                    <span className="text-muted text-xs">
                      {day.perBarber
                        .map((barber) =>
                          t.porBarbero(barber.name, barber.count),
                        )
                        .join(" · ")}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
