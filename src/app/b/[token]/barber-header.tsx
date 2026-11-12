import Link from "next/link";
import { barberAgendaHref } from "@/lib/routes";
import type { BarberView } from "@/modulos/agenda/dominio/barber-agenda";
import { initialsOf } from "@/ui/avatar";
import { cx } from "@/ui/cx";
import { LockIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.barbero;

// The top of B-01, B-02 and B-06: the barbershop, the barber's initials
// (decision B7), the greeting with today's summary, the paused notice when
// the barbershop is read only, and Hoy | Semana.
export function BarberHeader({
  token,
  barbershopName,
  barberName,
  summary,
  writable,
  view,
  onToday,
}: {
  token: string;
  barbershopName: string;
  barberName: string;
  summary: string;
  writable: boolean;
  view: BarberView;
  // "Hoy" is the current tab only on today's day.
  onToday: boolean;
}) {
  const firstName = barberName.trim().split(/\s+/)[0] ?? barberName;
  return (
    <header className="flex flex-col gap-2.5 px-5 pt-4.5 pb-3">
      <p className="text-muted text-[13px]">{t.encabezado(barbershopName)}</p>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-brand-soft text-brand-strong flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
        >
          {initialsOf(barberName)}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-[22px] font-bold">{t.hola(firstName)}</h1>
          <p className="text-muted text-sm">{summary}</p>
        </div>
      </div>
      {writable ? null : (
        <div
          role="status"
          className="bg-neutral-soft flex items-start gap-2.5 rounded-[14px] px-4 py-3.5"
        >
          <span className="text-muted flex pt-px">
            <LockIcon size={18} />
          </span>
          <div className="flex flex-col gap-0.5">
            <strong className="text-muted text-sm font-bold">
              {t.pausada.titulo}
            </strong>
            <span className="text-ink text-[13px]">{t.pausada.detalle}</span>
          </div>
        </div>
      )}
      <nav aria-label={t.vistas.etiqueta}>
        <div className="bg-neutral-soft flex gap-1 rounded-xl p-1">
          <Tab
            href={barberAgendaHref(token)}
            current={view === "dia" && onToday}
          >
            {t.vistas.hoy}
          </Tab>
          <Tab
            href={barberAgendaHref(token, { vista: "semana" })}
            current={view === "semana"}
          >
            {t.vistas.semana}
          </Tab>
        </div>
      </nav>
    </header>
  );
}

// Each half is 44 px tall, a little more than the design's 38, for the
// touch targets of F-01 (as D-30, decision A10 of task 4.1).
function Tab({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cx(
        "flex h-11 flex-1 items-center justify-center rounded-[10px] text-sm no-underline",
        current
          ? "text-ink bg-white font-bold shadow-[0_1px_2px_rgba(22,33,31,0.12)]"
          : "text-muted font-semibold",
      )}
    >
      {children}
    </Link>
  );
}
