"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCalendarDay, formatWallClock } from "@/lib/fechas/fechas";
import { buttonClasses } from "@/ui/button";
import { CalendarIcon, WarningIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import {
  DisabledContinue,
  StepHeader,
  StepTitle,
  SummaryBar,
} from "../booking-ui";
import { DayStrip, HourGrid, timesOf } from "../slot-picker";
import type { DayTimes } from "./slot-days";
import { capitalize, whenLine } from "./when";

const t = textos.reservas;

// The address of the details step (C-06): the flow with the services and the
// barber, plus the day and the time, in the order bookingQuery writes them.
export function withDayAndTime(
  href: string,
  date: string,
  time: string,
): string {
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("dia", date);
  params.set("hora", time);
  return `${path}?${params.toString()}`;
}

// The browser half of C-04 (C-05 without free times, C-07 after someone took
// the time): the day and the time are chosen here, from the free times the
// server computed for the whole window. The URL keeps what the customer
// arrived with; "Continuar" carries the choice to the details step, where
// the server takes over again.
export function TimeChooser({
  shopName,
  backHref,
  continueHref,
  otherBarberHref,
  days,
  today,
  date: initialDate,
  time: initialTime,
  taken,
  intro,
  namedBarber,
  priceCop,
}: {
  shopName: string;
  backHref: string;
  // The flow with the services and the barber, without day nor time.
  continueHref: string;
  otherBarberHref: string;
  days: DayTimes[];
  today: string;
  // What the URL asked for; dropped when it is not free.
  date: string | null;
  time: string | null;
  taken: string | null;
  // "Corte · 30 min · Ana".
  intro: string;
  // The chosen barber, or null for "El primero disponible".
  namedBarber: string | null;
  priceCop: number;
}) {
  const [choice, setChoice] = useState(() => ({
    date: initialDate,
    time: initialTime,
  }));
  // The times may change under the choice (a refresh after someone booked):
  // only what is still free counts.
  const date =
    choice.date !== null && days.some((d) => d.date === choice.date)
      ? choice.date
      : today;
  const day = days.find((d) => d.date === date);
  const times = timesOf(day);
  const time =
    choice.date === date && choice.time !== null && times.includes(choice.time)
      ? choice.time
      : null;
  const next = days.find((d) => d.date > date && timesOf(d).length > 0);
  const dayName = (value: string) =>
    value === today
      ? t.hoy.toLocaleLowerCase("es-CO")
      : t.hora.elDia(formatCalendarDay(value));
  const chooseDay = (value: string) => setChoice({ date: value, time: null });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StepHeader shopName={shopName} backHref={backHref} step={3} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pt-2.5 pb-4">
        {taken ? (
          <div
            role="status"
            className="bg-danger-soft flex gap-2.5 rounded-[14px] px-3.5 py-3"
          >
            <span className="text-danger">
              <WarningIcon size={20} />
            </span>
            <div className="flex flex-col gap-1">
              <strong className="text-danger text-sm">
                {t.hora.tomada.titulo}
              </strong>
              <span className="text-help">
                {t.hora.tomada.detalle(formatWallClock(taken))}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-help text-muted">{intro}</p>
        )}
        <StepTitle title={t.hora.titulo} />

        <DayStrip days={days} today={today} date={date} onChoose={chooseDay} />

        {!day || times.length === 0 ? (
          <div className="border-line rounded-card flex flex-col items-center gap-2.5 border bg-white px-4 py-6.5 text-center">
            <span className="text-muted">
              <CalendarIcon size={28} />
            </span>
            <strong className="text-[1.0625rem]">
              {namedBarber
                ? t.hora.sinHoras(namedBarber, dayName(date))
                : t.hora.sinHorasNadie(dayName(date))}
            </strong>
            <p className="text-muted text-sm">
              {next
                ? t.hora.proxima(
                    formatCalendarDay(next.date),
                    formatWallClock(timesOf(next)[0]!),
                  )
                : t.hora.ninguna}
            </p>
            {next ? (
              <button
                type="button"
                onClick={() => chooseDay(next.date)}
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                {t.hora.ir(formatCalendarDay(next.date))}
              </button>
            ) : null}
            <Link
              href={otherBarberHref}
              className={buttonClasses({ variant: "text", size: "md" })}
            >
              {t.hora.otroBarbero}
            </Link>
          </div>
        ) : (
          <HourGrid
            day={day}
            time={time}
            onChoose={(value) => setChoice({ date, time: value })}
          />
        )}
      </main>
      <SummaryBar
        summary={
          time
            ? whenLine(date, time)
            : `${capitalize(formatCalendarDay(date))} · ${t.hora.eligeHora}`
        }
        priceCop={priceCop}
      >
        {time ? (
          <Link
            href={withDayAndTime(continueHref, date, time)}
            className={buttonClasses()}
          >
            {t.continuar}
          </Link>
        ) : (
          <DisabledContinue />
        )}
      </SummaryBar>
    </div>
  );
}
