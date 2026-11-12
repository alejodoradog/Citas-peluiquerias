import Link from "next/link";
import {
  formatCalendarDay,
  formatMonthYear,
  formatShortWallClock,
  formatWallClock,
  getWeekday,
} from "@/lib/fechas/fechas";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import { dayPart, type DayPart } from "@/modulos/agenda/dominio/booking-flow";
import { cx } from "@/ui/cx";
import { textos } from "@/ui/textos";
import { capitalize } from "./reservar/summary";

const t = textos.reservas;
const PARTS: DayPart[] = ["morning", "afternoon", "evening"];

// The days of the booking window and the free times of one of them: C-04
// (booking) and C-10 (moving an appointment). Every choice is a link, so
// "atrás" and reloading keep it.

export function DayStrip({
  days,
  today,
  date,
  hrefFor,
}: {
  days: readonly DayAvailability[];
  today: string;
  // The chosen day, always one of `days` or today.
  date: string;
  hrefFor: (date: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-base font-semibold">
        {capitalize(formatMonthYear(date))}
      </p>
      <nav aria-label={t.hora.dias}>
        <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {days.map((d) => {
            const weekday = t.diasCortos[getWeekday(d.date)]!;
            const label = d.date === today ? t.hoy : weekday;
            const number = Number(d.date.slice(8));
            const selected = d.date === date;
            const free = d.slots.length > 0;
            // The chip shows "jue 12"; screen readers hear the whole date.
            // Its name comes from its content, never from an aria-label
            // that would not contain the visible text (WCAG 2.5.3).
            const fullDate = capitalize(formatCalendarDay(d.date));
            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={cx("text-xs", !selected && free && "text-muted")}
                >
                  {label}
                </span>
                <span aria-hidden="true" className="text-lg font-bold">
                  {number}
                </span>
                <span className="sr-only">{fullDate}</span>
              </>
            );
            const box =
              "flex h-16 w-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl no-underline";
            return (
              <li key={d.date}>
                {free || selected ? (
                  <Link
                    href={hrefFor(d.date)}
                    aria-current={selected ? "date" : undefined}
                    className={cx(
                      box,
                      selected
                        ? "border-brand bg-brand border-2 text-white"
                        : "border-line text-ink border bg-white",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    aria-label={t.hora.cerrado(fullDate)}
                    role="img"
                    className={cx(
                      box,
                      "border-line text-muted border border-dashed",
                    )}
                  >
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function HourGrid({
  times,
  time,
  hrefFor,
}: {
  // Bogotá wall times, "HH:MM", in order.
  times: readonly string[];
  time: string | null;
  hrefFor: (time: string) => string;
}) {
  return PARTS.map((part) => {
    const inPart = times.filter((value) => dayPart(value) === part);
    if (inPart.length === 0) return null;
    return (
      <section
        key={part}
        aria-labelledby={`parte-${part}`}
        className="flex flex-col gap-2.5"
      >
        <h2 id={`parte-${part}`} className="text-label text-muted">
          {t.hora.partes[part]}
        </h2>
        <ul className="grid grid-cols-4 gap-2">
          {inPart.map((value) => {
            const selected = value === time;
            return (
              <li key={value}>
                <Link
                  href={hrefFor(value)}
                  aria-current={selected ? "true" : undefined}
                  aria-label={formatWallClock(value)}
                  className={cx(
                    "flex h-11.5 items-center justify-center rounded-[10px] text-[0.9375rem] no-underline",
                    selected
                      ? "border-brand bg-brand border-2 font-bold text-white"
                      : "border-line text-ink border bg-white font-semibold",
                  )}
                >
                  {formatShortWallClock(value)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  });
}
