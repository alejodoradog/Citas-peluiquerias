import Link from "next/link";
import {
  formatCalendarDay,
  formatMonthYear,
  formatShortWallClock,
  formatWallClock,
  getWeekday,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  dayPart,
  FIRST_AVAILABLE,
  type BookingSelection,
  type DayPart,
} from "@/modulos/agenda/dominio/booking-flow";
import { buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { CalendarIcon, WarningIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import {
  DisabledContinue,
  StepHeader,
  StepTitle,
  SummaryBar,
} from "../booking-ui";
import { barberName, capitalize, servicesLine, whenLine } from "./summary";

const t = textos.reservas;
const PARTS: DayPart[] = ["morning", "afternoon", "evening"];

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

        <div className="flex flex-col gap-2.5">
          <p className="text-base font-semibold">
            {capitalize(formatMonthYear(date))}
          </p>
          <nav aria-label={t.hora.dias}>
            <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {availability.days.map((d) => {
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
                      className={cx(
                        "text-xs",
                        !selected && free && "text-muted",
                      )}
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
                        href={
                          flow +
                          bookingQuery({ ...base, date: d.date, step: "hora" })
                        }
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
                        aria-label={t.hora.cerrado(
                          capitalize(formatCalendarDay(d.date)),
                        )}
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
          PARTS.map((part) => {
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
                          href={
                            flow +
                            bookingQuery({
                              ...base,
                              date,
                              time: value,
                              step: "hora",
                            })
                          }
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
          })
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
