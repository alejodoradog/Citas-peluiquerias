import {
  formatCalendarDay,
  formatWallClock,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import {
  manageQuery,
  type ManageSelection,
} from "@/modulos/agenda/dominio/manage-flow";
import { CalendarIcon, WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { SummaryBar } from "../../[slug]/booking-ui";
import { capitalize, whenLine } from "../../[slug]/reservar/summary";
import { DayStrip, HourGrid } from "../../[slug]/slot-picker";
import { ManageHeader } from "./manage-header";
import { RescheduleForm } from "./reschedule-form";

const t = textos.reservas.gestionar.reprogramar;
const r = textos.reservas;

// C-10 "Cambiar día u hora": the free times of the same barber for an
// appointment of the same length (loadRescheduleAvailability). As in C-04,
// every choice is a link; "Cambiar mi cita" moves it.
export function RescheduleStep({
  token,
  days,
  today,
  selection,
  current,
  summary,
  barberName,
  priceCop,
}: {
  token: string;
  days: DayAvailability[];
  today: string;
  selection: ManageSelection;
  // Where the appointment is now, in Bogotá.
  current: { date: string; time: string };
  summary: string;
  barberName: string;
  priceCop: number;
}) {
  const link = routes.manageAppointment(token);
  const date =
    selection.date && days.some((day) => day.date === selection.date)
      ? selection.date
      : days.some((day) => day.date === current.date)
        ? current.date
        : today;
  const day = days.find((d) => d.date === date);
  const times = (day?.slots ?? [])
    .map((slot) => toBogotaTime(slot.start))
    // Its own time is not a change.
    .filter((value) => !(date === current.date && value === current.time));
  const time =
    selection.time && times.includes(selection.time) ? selection.time : null;
  const anyFree = days.some((d) => d.slots.length > 0);
  const dayName =
    date === today
      ? r.hoy.toLocaleLowerCase("es-CO")
      : r.hora.elDia(formatCalendarDay(date));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ManageHeader
        name={textos.reservas.gestionar.cambiar}
        locality={summary}
        backHref={link}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pt-1.5 pb-4">
        {selection.taken ? (
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
                {r.hora.tomada.detalle(formatWallClock(selection.taken))}
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
            hrefFor={(value) =>
              link + manageQuery({ step: "cambiar", date: value })
            }
          />
        ) : null}

        {!anyFree ? (
          <p className="text-body text-muted">{t.sinHorasMes(barberName)}</p>
        ) : times.length === 0 ? (
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
            times={times}
            time={time}
            hrefFor={(value) =>
              link + manageQuery({ step: "cambiar", date, time: value })
            }
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
