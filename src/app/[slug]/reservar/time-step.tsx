import Link from "next/link";
import {
  formatCalendarDay,
  formatWallClock,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  FIRST_AVAILABLE,
  type BookingSelection,
} from "@/modulos/agenda/dominio/booking-flow";
import { buttonClasses } from "@/ui/button";
import { CalendarIcon, WarningIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import {
  DisabledContinue,
  StepHeader,
  StepTitle,
  SummaryBar,
} from "../booking-ui";
import { DayStrip, HourGrid } from "../slot-picker";
import { barberName, capitalize, servicesLine, whenLine } from "./summary";

const t = textos.reservas;

// C-04 (C-05 without free times, C-07 after someone took the time): the days
// of the booking window and the free times of the chosen one.
export function TimeStep({
  profile,
  selection,
  availability,
  today,
}: {
  profile: PublicProfile;
  selection: BookingSelection;
  availability: PublicAvailability;
  today: string;
}) {
  const flow = routes.bookingFlow(profile.slug);
  const base = { serviceIds: selection.serviceIds, barber: selection.barber };
  const date =
    selection.date &&
    availability.days.some((day) => day.date === selection.date)
      ? selection.date
      : today;
  const day = availability.days.find((d) => d.date === date);
  const times = (day?.slots ?? []).map((slot) => toBogotaTime(slot.start));
  const time =
    selection.time && times.includes(selection.time) ? selection.time : null;
  const next = availability.days.find(
    (d) => d.date > date && d.slots.length > 0,
  );
  const who = barberName(profile, selection.barber);
  const dayName = (value: string) =>
    value === today
      ? t.hoy.toLocaleLowerCase("es-CO")
      : t.hora.elDia(formatCalendarDay(value));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StepHeader
        shopName={profile.name}
        backHref={
          flow +
          bookingQuery({ serviceIds: selection.serviceIds, step: "barbero" })
        }
        step={3}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pt-2.5 pb-4">
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
                {t.hora.tomada.titulo}
              </strong>
              <span className="text-help">
                {t.hora.tomada.detalle(formatWallClock(selection.taken))}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-help text-muted">
            {servicesLine(availability)}
            {who ? ` · ${who}` : ""}
          </p>
        )}
        <StepTitle title={t.hora.titulo} />

        <DayStrip
          days={availability.days}
          today={today}
          date={date}
          hrefFor={(value) =>
            flow + bookingQuery({ ...base, date: value, step: "hora" })
          }
        />

        {times.length === 0 ? (
          <div className="border-line rounded-card flex flex-col items-center gap-2.5 border bg-white px-4 py-6.5 text-center">
            <span className="text-muted">
              <CalendarIcon size={28} />
            </span>
            <strong className="text-[1.0625rem]">
              {who && selection.barber !== FIRST_AVAILABLE
                ? t.hora.sinHoras(who, dayName(date))
                : t.hora.sinHorasNadie(dayName(date))}
            </strong>
            <p className="text-muted text-sm">
              {next
                ? t.hora.proxima(
                    formatCalendarDay(next.date),
                    formatWallClock(toBogotaTime(next.slots[0]!.start)),
                  )
                : t.hora.ninguna}
            </p>
            {next ? (
              <Link
                href={
                  flow +
                  bookingQuery({ ...base, date: next.date, step: "hora" })
                }
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                {t.hora.ir(formatCalendarDay(next.date))}
              </Link>
            ) : null}
            <Link
              href={
                flow +
                bookingQuery({
                  serviceIds: selection.serviceIds,
                  step: "barbero",
                })
              }
              className={buttonClasses({ variant: "text", size: "md" })}
            >
              {t.hora.otroBarbero}
            </Link>
          </div>
        ) : (
          <HourGrid
            times={times}
            time={time}
            hrefFor={(value) =>
              flow + bookingQuery({ ...base, date, time: value, step: "hora" })
            }
          />
        )}
      </main>
      <SummaryBar
        summary={
          time
            ? whenLine(date, time)
            : `${capitalize(formatCalendarDay(date))} · ${t.hora.eligeHora}`
        }
        priceCop={availability.priceCop}
      >
        {time ? (
          <Link
            href={flow + bookingQuery({ ...base, date, time })}
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
