"use client";

import { useState } from "react";
import { formatCalendarDay, formatWallClock } from "@/lib/fechas/fechas";
import { CalendarIcon, WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { SummaryBar } from "../../[slug]/booking-ui";
import type { DayTimes } from "../../[slug]/reservar/slot-days";
import { capitalize, whenLine } from "../../[slug]/reservar/when";
import { DayStrip, HourGrid, timesOf } from "../../[slug]/slot-picker";
import { ManageHeader } from "./manage-header";
import { RescheduleForm } from "./reschedule-form";

const t = textos.reservas.gestionar.reprogramar;
const r = textos.reservas;

// The browser half of C-10: the day and the time are chosen here, from the
// free times the server computed for the whole window, and "Cambiar mi cita"
// sends them. Its own time is not a change, so it is never offered.
export function RescheduleChooser({
  token,
  backHref,
  days,
  today,
  date: initialDate,
  time: initialTime,
  taken,
  current,
  summary,
  barberName,
  priceCop,
}: {
  token: string;
  backHref: string;
  days: DayTimes[];
  today: string;
  // What the URL asked for; dropped when it is not free.
  date: string | null;
  time: string | null;
  taken: string | null;
  // Where the appointment is now, in Bogotá.
  current: { date: string; time: string };
  summary: string;
  barberName: string;
  priceCop: number;
}) {
  const [choice, setChoice] = useState(() => ({
    date: initialDate,
    time: initialTime,
  }));
  // "Alguien reservó las…" leaves with the first choice, as it did when a
  // choice was a new page.
  const [chose, setChose] = useState(false);
  const known = (value: string | null): value is string =>
    value !== null && days.some((day) => day.date === value);
  // The day asked for, else the appointment's own, else today.
  const date = known(choice.date)
    ? choice.date
    : known(current.date)
      ? current.date
      : today;
  const day = days.find((d) => d.date === date);
  const own = date === current.date ? current.time : null;
  const times = timesOf(day, own);
  const time =
    choice.date === date && choice.time !== null && times.includes(choice.time)
      ? choice.time
      : null;
  const anyFree = days.some((d) => timesOf(d).length > 0);
  const dayName =
    date === today
      ? r.hoy.toLocaleLowerCase("es-CO")
      : r.hora.elDia(formatCalendarDay(date));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ManageHeader
        name={textos.reservas.gestionar.cambiar}
        locality={summary}
        backHref={backHref}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pt-1.5 pb-4">
        {taken && !chose ? (
          <div
            role="status"
            className="bg-danger-soft flex gap-2.5 rounded-[14px] px-3.5 py-3"
          >
            <span className="text-danger">
              <WarningIcon size={20} />
            </span>
            <div className="flex flex-col gap-1">
              <strong className="text-danger text-sm">
                {r.hora.tomada.titulo}
              </strong>
              <span className="text-help">
                {r.hora.tomada.detalle(formatWallClock(taken))}
              </span>
            </div>
          </div>
        ) : (
          <Notice
            tone="info"
            title={t.tienes(whenLine(current.date, current.time))}
          >
            {t.liberada}
          </Notice>
        )}

        {anyFree ? (
          <DayStrip
            days={days}
            today={today}
            date={date}
            onChoose={(value) => {
              setChoice({ date: value, time: null });
              setChose(true);
            }}
          />
        ) : null}

        {!anyFree ? (
          <p className="text-body text-muted">{t.sinHorasMes(barberName)}</p>
        ) : !day || times.length === 0 ? (
          <div className="border-line rounded-card flex flex-col items-center gap-2.5 border bg-white px-4 py-6.5 text-center">
            <span className="text-muted">
              <CalendarIcon size={28} />
            </span>
            <strong className="text-[1.0625rem]">
              {t.sinHoras(barberName, dayName)}
            </strong>
          </div>
        ) : (
          <HourGrid
            day={day}
            skip={own}
            time={time}
            onChoose={(value) => {
              setChoice({ date, time: value });
              setChose(true);
            }}
          />
        )}
      </main>
      <SummaryBar
        summary={
          time
            ? whenLine(date, time)
            : `${capitalize(formatCalendarDay(date))} · ${r.hora.eligeHora}`
        }
        priceCop={priceCop}
      >
        <RescheduleForm token={token} date={date} time={time} />
      </SummaryBar>
    </div>
  );
}
