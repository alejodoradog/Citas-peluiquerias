import Link from "next/link";
import { routes } from "@/lib/routes";
import { removeBlock } from "@/modulos/agenda/acciones/barber";
import { type BarberDayItem } from "@/modulos/agenda/dominio/barber-agenda";
import { minutesBetween } from "@/modulos/agenda/dominio/owner-agenda";
import { Chip, type ChipTone } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { LockIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import { blockLabel, servicesLabel, timeLabel } from "./labels";
import { MarkButtons } from "./mark-buttons";

const t = textos.barbero;
const a = textos.agenda;

// The states of F-01, as the owner's agenda shows them (task 4.1).
const LOOK_TONES = {
  new: "warning",
  confirmed: "brand",
  manual: "neutral",
  attended: "success",
  no_show: "danger",
} as const satisfies Record<string, ChipTone>;

const time = "w-21 shrink-0 text-sm font-bold whitespace-nowrap";
const STRIPES =
  "border border-dashed border-line bg-[repeating-linear-gradient(135deg,var(--color-neutral-soft)_0_6px,var(--color-paper)_6px_12px)]";

// B-01: the barber's day in order. Each appointment opens B-03, and the ones
// that already started can be marked right here (decision B2); their own
// blocks can be removed (decision B4).
export function DayList({
  token,
  date,
  items,
}: {
  token: string;
  date: string;
  items: readonly BarberDayItem[];
}) {
  if (items.length === 0) {
    return <p className="text-muted px-1 py-3 text-sm">{t.sinCitasDia}</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        if (item.kind === "appointment") {
          const { appointment, look } = item;
          return (
            <li
              key={item.id}
              className="border-line flex flex-col rounded-[14px] border bg-white px-3.5 py-3"
            >
              <Link
                href={routes.barberAppointment(token, appointment.id)}
                className="text-ink flex items-start gap-3 no-underline"
              >
                <span className={time}>{timeLabel(item.start)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.75">
                  <span
                    className={cx(
                      "text-[15px] font-bold",
                      look === "no_show" && "line-through",
                    )}
                  >
                    {appointment.customerName}
                  </span>
                  <span className="text-muted text-[13px]">
                    {`${servicesLabel(appointment.serviceNames)} · ${a.minutos(minutesBetween(item.start, item.end))}`}
                  </span>
                </span>
                <Chip tone={LOOK_TONES[look]}>{a.estados[look]}</Chip>
              </Link>
              {item.markable ? (
                <MarkButtons
                  token={token}
                  appointmentId={appointment.id}
                  customerName={appointment.customerName}
                  back={date}
                />
              ) : null}
            </li>
          );
        }
        const label = `${blockLabel(item.block)} · ${a.minutos(minutesBetween(item.start, item.end))}`;
        return (
          <li
            key={item.id}
            className={cx(
              "flex items-center gap-3 rounded-[14px] px-3.5 py-3",
              STRIPES,
            )}
          >
            <span className={cx(time, "text-muted self-start")}>
              {timeLabel(item.start)}
            </span>
            <span className="text-muted flex flex-1 items-center gap-1.5 font-semibold">
              <LockIcon size={16} />
              {label}
            </span>
            {item.removable ? (
              <form action={removeBlock}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="bloqueo" value={item.block.id} />
                <input type="hidden" name="volver" value={date} />
                {/* 44 px tall, the design's 32 grown for F-01's touch targets. */}
                <button
                  type="submit"
                  aria-label={t.quitarDe(label)}
                  className="border-line text-ink min-h-11 rounded-lg border bg-white px-2.5 text-[13px] font-semibold"
                >
                  {t.quitar}
                </button>
              </form>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
