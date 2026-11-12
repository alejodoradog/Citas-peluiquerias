import Link from "next/link";
import { toBogotaDate, toBogotaTime } from "@/lib/fechas/fechas";
import { newAppointmentHref, routes } from "@/lib/routes";
import {
  shortCustomerName,
  splitAtHours,
  type AgendaItem,
  type AppointmentLook,
  type BarberDay,
} from "@/modulos/agenda/dominio/owner-agenda";
import { Avatar } from "@/ui/avatar";
import { cx } from "@/ui/cx";
import { PlusIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import { hourLabel, timeLabel } from "./agenda-labels";
import { BlockButton, type RemoveBlockAction } from "./block-button";
import { timeRange } from "./citas/labels";

const t = textos.agenda;

// D-30 draws an hour 56 px tall.
const HOUR_PX = 56;
const HOUR_MS = 3_600_000;

// The colors of F-01's states (decision A3: "Nueva" is a recent web booking).
export const LOOK_CLASSES: Record<AppointmentLook, string> = {
  new: "bg-warning-soft text-warning",
  confirmed: "bg-brand-soft text-brand-strong",
  manual: "bg-neutral-soft text-ink",
  attended: "bg-success-soft text-success",
  no_show: "bg-danger-soft text-danger",
};

export const BLOCK_STRIPES =
  "border border-dashed border-line text-muted bg-[repeating-linear-gradient(135deg,var(--color-neutral-soft)_0_6px,var(--color-paper)_6px_12px)]";

export function servicesLabel(names: readonly string[]): string {
  return names.join(" + ");
}

export function blockLabel(item: Extract<AgendaItem, { kind: "block" }>) {
  return item.reason ?? (item.wholeShop ? t.cierre : t.bloqueo);
}

// The sheet of a block (task 4.2): "Kevin · 1:00 – 2:00 p. m.", or the
// whole barbershop.
export function blockDetail(
  item: Extract<AgendaItem, { kind: "block" }>,
  barberName: string,
): string {
  const [from, until] = timeRange(item.start, item.end).split(" – ");
  return t.bloqueoHoja.quien(
    item.wholeShop ? t.bloquear.todaLaBarberia : barberName,
    from!,
    until!,
  );
}

// The day by barber, to scale (D-30): a column per barber, the hours down
// the side, appointments and blocks where they fall, the free spaces as
// links to a new appointment, and a red line at the current time. Cards of
// short appointments are as small as the design draws them; D-31 lists the
// same day with full-size rows (decision A9).
export function DayGrid({
  date,
  days,
  hours,
  now,
  barberHref,
  removeBlock,
}: {
  date: string;
  days: readonly BarberDay[];
  hours: { from: Date; until: Date };
  now: Date;
  barberHref: (barberId: string) => string;
  removeBlock: RemoveBlockAction;
}) {
  const from = hours.from.getTime();
  const total = Math.round((hours.until.getTime() - from) / HOUR_MS);
  const until = hours.until.getTime();
  // Blocks can reach past the hours drawn (a closure of the whole day): they
  // are cut to them, and what falls outside is not drawn.
  const px = (instant: Date) =>
    ((Math.min(Math.max(instant.getTime(), from), until) - from) / HOUR_MS) *
    HOUR_PX;
  const shown = days.map((day) => ({
    ...day,
    items: day.items.filter(
      (item) => item.end.getTime() > from && item.start.getTime() < until,
    ),
  }));
  const columns = {
    gridTemplateColumns: `44px repeat(${days.length}, minmax(64px, 1fr))`,
  };
  const showNow =
    toBogotaDate(now) === date && now >= hours.from && now < hours.until;

  return (
    <section
      aria-label={t.columnas}
      data-agenda-grid=""
      className="overflow-x-auto"
    >
      <div className="min-w-full">
        <div className="border-line grid border-y bg-white" style={columns}>
          <div />
          {days.map(({ barber }) => (
            <Link
              key={barber.id}
              href={barberHref(barber.id)}
              className="text-ink flex flex-col items-center gap-0.5 py-1.5 no-underline"
            >
              <Avatar name={barber.name} size="sm" />
              <span className="max-w-full truncate px-1 text-xs font-bold">
                {barber.name}
              </span>
            </Link>
          ))}
        </div>
        <div
          className="relative mt-2 grid bg-white"
          style={{ ...columns, height: total * HOUR_PX }}
        >
          <div className="relative" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className="text-muted absolute right-1.5 text-[11px]"
                style={{ top: i * HOUR_PX - 6 }}
              >
                {hourLabel(new Date(from + i * HOUR_MS))}
              </div>
            ))}
          </div>
          {shown.map((day) => (
            <Column
              key={day.barber.id}
              day={day}
              date={date}
              hours={total}
              px={px}
              removeBlock={removeBlock}
            />
          ))}
          {showNow ? (
            <>
              <div
                aria-hidden="true"
                className="border-danger pointer-events-none absolute right-0 left-11 border-t-2"
                style={{ top: px(now) }}
              />
              <div
                aria-hidden="true"
                className="bg-danger pointer-events-none absolute left-[39px] size-2.5 rounded-full"
                style={{ top: px(now) - 5 }}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Column({
  day,
  date,
  hours,
  px,
  removeBlock,
}: {
  day: BarberDay;
  date: string;
  hours: number;
  px: (instant: Date) => number;
  removeBlock: RemoveBlockAction;
}) {
  return (
    <div className="border-neutral-soft relative border-l">
      {Array.from({ length: hours + 1 }, (_, i) => (
        <div
          key={`linea-${i}`}
          aria-hidden="true"
          className="border-neutral-soft absolute inset-x-0 border-t"
          style={{ top: i * HOUR_PX }}
        />
      ))}
      {day.items.map((item) => {
        const style = {
          top: px(item.start),
          height: Math.max(px(item.end) - px(item.start) - 2, 4),
        };
        switch (item.kind) {
          case "appointment": {
            const { appointment, look } = item;
            const name = shortCustomerName(appointment.customerName);
            const services = servicesLabel(appointment.serviceNames);
            const minutes =
              (item.end.getTime() - item.start.getTime()) / 60_000;
            return (
              <Link
                key={appointment.id}
                href={routes.panelAppointment(appointment.id)}
                data-to-scale=""
                className={cx(
                  "absolute inset-x-0.5 z-10 flex flex-col gap-px overflow-hidden rounded-lg px-[5px] py-[3px] no-underline",
                  LOOK_CLASSES[look],
                )}
                style={style}
              >
                <span
                  className={cx(
                    "truncate text-[11px] leading-[1.2] font-bold",
                    look === "no_show" && "line-through",
                  )}
                >
                  {name}
                </span>
                {/* The name comes from what the card shows, then what it has
                    no room for (WCAG 2.5.3): services, time and state. */}
                {minutes >= 40 ? (
                  <span className="text-[10px] leading-[1.2]">
                    {look === "manual" ? `${services} · ${t.manual}` : services}
                  </span>
                ) : (
                  <span className="sr-only">, {services}</span>
                )}
                <span className="sr-only">
                  , {t.cita(timeLabel(item.start), t.estados[look])}
                </span>
              </Link>
            );
          }
          case "block":
            return (
              <BlockButton
                key={`${item.id}-${day.barber.id}`}
                id={item.id}
                end={item.end}
                action={removeBlock}
                detail={blockDetail(item, day.barber.name)}
                className={cx(
                  "absolute inset-x-0.5 z-10 overflow-hidden rounded-lg px-[5px] py-[3px]",
                  BLOCK_STRIPES,
                )}
                style={style}
              >
                <span className="block truncate text-[11px] leading-[1.2] font-bold">
                  {blockLabel(item)}
                </span>
                <span className="sr-only">, {timeLabel(item.start)}</span>
              </BlockButton>
            );
          case "free":
            return splitAtHours(item).map((piece) => {
              const hora = toBogotaTime(piece.start);
              return (
                <Link
                  key={piece.start.toISOString()}
                  data-to-scale=""
                  href={newAppointmentHref({
                    barbero: day.barber.id,
                    dia: date,
                    hora,
                  })}
                  aria-label={t.libreDesde(
                    timeLabel(piece.start),
                    day.barber.name,
                  )}
                  className="group text-brand-strong hover:bg-brand-soft focus-visible:bg-brand-soft absolute inset-x-0.5 flex items-start justify-center rounded-lg pt-1"
                  style={{
                    top: px(piece.start),
                    height: px(piece.end) - px(piece.start) - 2,
                  }}
                >
                  <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <PlusIcon size={16} />
                  </span>
                </Link>
              );
            });
        }
      })}
    </div>
  );
}
