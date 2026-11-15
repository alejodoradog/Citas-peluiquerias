"use client";

import { useEffect, useRef } from "react";
import {
  formatCalendarDay,
  formatMonthYear,
  formatShortWallClock,
  formatWallClock,
  getWeekday,
} from "@/lib/fechas/fechas";
import type { DayPart } from "@/modulos/agenda/dominio/booking-flow";
import { cx } from "@/ui/cx";
import { textos } from "@/ui/textos";
import type { DayTimes } from "./reservar/slot-days";
import { capitalize } from "./reservar/when";

const t = textos.reservas;
const PARTS: readonly DayPart[] = ["morning", "afternoon", "evening"];

// The days of the booking window and the free times of one of them: C-04
// (booking) and C-10 (moving an appointment). The free times of the whole
// window come with the page (slot-days.ts), so choosing a day or an hour is
// a toggle in the browser that answers the tap at once, with no trip to the
// server. Only "Continuar" (or "Cambiar mi cita") leaves the screen, with
// the choice.

// The free times of a day, in order, without `skip` (an appointment's own
// time is not a change).
export function timesOf(
  day: DayTimes | undefined,
  skip: string | null = null,
): string[] {
  if (!day) return [];
  return PARTS.flatMap((part) => day.times[part]).filter(
    (value) => value !== skip,
  );
}

export function DayStrip({
  days,
  today,
  date,
  onChoose,
}: {
  days: readonly DayTimes[];
  today: string;
  // The chosen day, always one of `days` or today.
  date: string;
  onChoose: (date: string) => void;
}) {
  const chosen = useRef<HTMLButtonElement>(null);
  // A day chosen from elsewhere ("Ir al …", a link that carries it) may be
  // past the edge of the strip: bring it into view, sideways only.
  useEffect(() => {
    chosen.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [date]);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-base font-semibold">
        {capitalize(formatMonthYear(date))}
      </p>
      <div role="group" aria-label={t.hora.dias}>
        <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {days.map((d) => {
            const weekday = t.diasCortos[getWeekday(d.date)]!;
            const label = d.date === today ? t.hoy : weekday;
            const number = Number(d.date.slice(8));
            const selected = d.date === date;
            const free = timesOf(d).length > 0;
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
              "flex h-16 w-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl";
            return (
              <li key={d.date}>
                {free || selected ? (
                  <button
                    type="button"
                    ref={selected ? chosen : undefined}
                    aria-pressed={selected}
                    onClick={() => {
                      if (!selected) onChoose(d.date);
                    }}
                    className={cx(
                      box,
                      "cursor-pointer",
                      selected
                        ? "border-brand bg-brand border-2 text-white"
                        : "border-line text-ink border bg-white",
                    )}
                  >
                    {content}
                  </button>
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
      </div>
    </div>
  );
}

export function HourGrid({
  day,
  skip = null,
  time,
  onChoose,
}: {
  day: DayTimes;
  // A time not offered (the appointment's own, when moving it).
  skip?: string | null;
  time: string | null;
  onChoose: (time: string) => void;
}) {
  return PARTS.map((part) => {
    const inPart = day.times[part].filter((value) => value !== skip);
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
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={formatWallClock(value)}
                  onClick={() => onChoose(value)}
                  className={cx(
                    "flex h-11.5 w-full cursor-pointer items-center justify-center rounded-[10px] text-[0.9375rem]",
                    selected
                      ? "border-brand bg-brand border-2 font-bold text-white"
                      : "border-line text-ink border bg-white font-semibold",
                  )}
                >
                  {formatShortWallClock(value)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  });
}
