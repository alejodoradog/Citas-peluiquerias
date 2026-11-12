import Link from "next/link";
import { toBogotaTime } from "@/lib/fechas/fechas";
import { newAppointmentHref, routes } from "@/lib/routes";
import {
  minutesBetween,
  shortCustomerName,
  type BarberDay,
} from "@/modulos/agenda/dominio/owner-agenda";
import { Chip, type ChipTone } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { LockIcon, PlusIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import { hourLabel, timeLabel } from "./agenda-labels";
import { BLOCK_STRIPES, blockLabel, servicesLabel } from "./day-grid";

const t = textos.agenda;

const LOOK_TONES = {
  new: "warning",
  confirmed: "brand",
  manual: "neutral",
  attended: "success",
  no_show: "danger",
} as const satisfies Record<string, ChipTone>;

const row = "rounded-[14px] flex gap-3 px-3.5 py-3";
const time = "w-21 shrink-0 text-sm font-bold whitespace-nowrap";

// D-31: one barber's day as a list, in order: appointments with their state,
// free spaces that lead to a new appointment, and blocks.
export function BarberDayList({ day, date }: { day: BarberDay; date: string }) {
  return (
    <ul className="flex flex-col gap-2.5 px-5 pb-4">
      {day.items.map((item) => {
        switch (item.kind) {
          case "appointment": {
            const { appointment, look } = item;
            const minutes = minutesBetween(item.start, item.end);
            const services = servicesLabel(appointment.serviceNames);
            return (
              <li key={appointment.id}>
                <Link
                  href={routes.panelAppointment(appointment.id)}
                  className={cx(
                    row,
                    "border-line text-ink items-start border bg-white no-underline",
                  )}
                >
                  <span className={time}>{timeLabel(item.start)}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={cx(
                        "text-[15px] font-bold",
                        look === "no_show" && "line-through",
                      )}
                    >
                      {shortCustomerName(appointment.customerName)}
                    </span>
                    <span className="text-help text-muted">
                      {`${services} · ${t.minutos(minutes)}`}
                    </span>
                  </span>
                  <Chip tone={LOOK_TONES[look]}>{t.estados[look]}</Chip>
                </Link>
              </li>
            );
          }
          case "free":
            return (
              <li key={`libre-${item.start.toISOString()}`}>
                <Link
                  href={newAppointmentHref({
                    barbero: day.barber.id,
                    dia: date,
                    hora: toBogotaTime(item.start),
                  })}
                  className={cx(
                    row,
                    "border-brand text-brand-strong items-center border border-dashed text-sm font-bold no-underline",
                  )}
                >
                  <span className={time}>{timeLabel(item.start)}</span>
                  <PlusIcon size={16} />
                  {t.libre(hourLabel(item.end))}
                </Link>
              </li>
            );
          case "block":
            return (
              <li key={`bloqueo-${item.id}`} className={cx(row, BLOCK_STRIPES)}>
                <span className={cx(time, "text-muted")}>
                  {timeLabel(item.start)}
                </span>
                <span className="text-muted flex items-center gap-1.5 font-semibold">
                  <LockIcon size={16} />
                  {`${blockLabel(item)} · ${t.minutos(minutesBetween(item.start, item.end))}`}
                </span>
              </li>
            );
        }
      })}
    </ul>
  );
}
