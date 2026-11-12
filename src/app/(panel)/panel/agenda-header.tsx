import Link from "next/link";
import type { ReactNode } from "react";
import { agendaHref, type AgendaQueryParams } from "@/lib/routes";
import type { AgendaView } from "@/modulos/agenda/dominio/owner-agenda";
import { Avatar } from "@/ui/avatar";
import { cx } from "@/ui/cx";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.agenda;

// Where the agenda is: the view, the day it shows (null for today) and the
// barber (null for everyone). Every control of the header is a link to the
// same screen with another query, so "back" and reloading keep it.
export type AgendaPlace = {
  view: AgendaView;
  date: string;
  today: string;
  barberId: string | null;
};

export function placeHref(
  place: AgendaPlace,
  change: Partial<Omit<AgendaPlace, "today">> = {},
): string {
  const next = { ...place, ...change };
  const query: AgendaQueryParams = {};
  if (next.view === "semana") query.vista = "semana";
  if (next.date !== place.today) query.dia = next.date;
  if (next.barberId) query.barbero = next.barberId;
  return agendaHref(query);
}

export type HeaderBarber = { id: string; name: string };

const squareLink =
  "border-line text-ink hover:bg-paper flex size-11 shrink-0 items-center justify-center rounded-xl border bg-white no-underline";

// Today, back and forward: a day in the day view, a week in the week view.
export function DayArrows({
  place,
  previous,
  next,
  showToday,
}: {
  place: AgendaPlace;
  previous: string;
  next: string;
  showToday: boolean;
}) {
  const unit = place.view === "semana" ? "semana" : "dia";
  return (
    <div className="flex shrink-0 gap-1">
      {showToday ? (
        <Link
          href={placeHref(place, { date: place.today })}
          className={cx(squareLink, "w-auto px-3 text-sm font-semibold")}
        >
          {t.irAHoy}
        </Link>
      ) : null}
      <Link
        href={placeHref(place, { date: previous })}
        aria-label={t.anterior[unit]}
        className={squareLink}
      >
        <ChevronLeftIcon size={18} />
      </Link>
      <Link
        href={placeHref(place, { date: next })}
        aria-label={t.siguiente[unit]}
        className={squareLink}
      >
        <ChevronRightIcon size={18} />
      </Link>
    </div>
  );
}

// D-30, D-32 and D-33: the sede, the day or the week, its arrows, Día or
// Semana, the barber filter and a line of summary.
export function AgendaHeader({
  shopName,
  title,
  place,
  previous,
  next,
  showToday,
  barbers,
  summary,
}: {
  shopName: string;
  title: string;
  place: AgendaPlace;
  previous: string;
  next: string;
  showToday: boolean;
  barbers: readonly HeaderBarber[];
  summary: string;
}) {
  return (
    <header className="flex flex-col gap-2.5 px-4 pt-3.5 pb-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-help text-muted">{shopName}</span>
          <h1 className="text-section">{title}</h1>
        </div>
        <DayArrows
          place={place}
          previous={previous}
          next={next}
          showToday={showToday}
        />
      </div>
      <div className="flex items-center gap-2">
        <ViewSwitch place={place} />
        <BarberFilter place={place} barbers={barbers} />
      </div>
      <p className="text-help text-muted">{summary}</p>
    </header>
  );
}

// Día | Semana (the segmented control of D-30). Each half is 44 px tall, a
// little more than the design's 38, for the touch targets of F-01.
function ViewSwitch({ place }: { place: AgendaPlace }) {
  const option = (view: AgendaView, label: string) => {
    const current = place.view === view;
    return (
      <Link
        href={placeHref(place, { view })}
        aria-current={current ? "page" : undefined}
        className={cx(
          "flex h-11 flex-1 items-center justify-center rounded-[10px] text-sm no-underline",
          current
            ? "text-ink bg-white font-bold shadow-[0_1px_2px_rgba(22,33,31,0.12)]"
            : "text-muted font-semibold",
        )}
      >
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label={t.vistas.etiqueta} className="flex-1">
      <div className="bg-neutral-soft flex gap-1 rounded-xl p-1">
        {option("dia", t.vistas.dia)}
        {option("semana", t.vistas.semana)}
      </div>
    </nav>
  );
}

// "Todos" or a barber's name; it opens the list of barbers, each a link.
// A native disclosure: it works before the page's JavaScript arrives.
function BarberFilter({
  place,
  barbers,
}: {
  place: AgendaPlace;
  barbers: readonly HeaderBarber[];
}) {
  const current =
    barbers.find((barber) => barber.id === place.barberId)?.name ??
    t.barberos.todos;
  const option = (barberId: string | null, label: ReactNode, key: string) => (
    <li key={key}>
      <Link
        href={placeHref(place, { barberId })}
        aria-current={place.barberId === barberId ? "true" : undefined}
        className={cx(
          "text-ink hover:bg-paper flex min-h-11 items-center gap-2 px-3.5 text-sm font-semibold no-underline",
          place.barberId === barberId && "bg-brand-soft",
        )}
      >
        {label}
      </Link>
    </li>
  );
  return (
    // Keyed by the filter, so it closes once the owner picks a barber.
    <details key={place.barberId ?? "todos"} className="relative shrink-0">
      <summary className="border-line text-ink flex h-11.5 cursor-pointer list-none items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold whitespace-nowrap [&::-webkit-details-marker]:hidden">
        <UsersIcon size={16} />
        <span className="sr-only">{t.barberos.etiqueta}: </span>
        {current}
      </summary>
      <ul className="border-line rounded-card absolute right-0 z-20 mt-1 flex max-h-80 min-w-48 flex-col overflow-y-auto border bg-white py-1 shadow-lg">
        {option(null, t.barberos.todos, "todos")}
        {barbers.map((barber) => option(barber.id, barber.name, barber.id))}
      </ul>
    </details>
  );
}

// The barbers of D-31 as chips: "Todos" goes back to every column. 44 px
// tall, a little more than the design's 40, for F-01.
export function BarberChips({
  place,
  barbers,
}: {
  place: AgendaPlace;
  barbers: readonly HeaderBarber[];
}) {
  const chip =
    "flex h-11 shrink-0 items-center rounded-full text-sm font-semibold no-underline";
  return (
    <nav aria-label={t.barberos.etiqueta}>
      <ul className="flex gap-2 overflow-x-auto px-5 pt-1 pb-3">
        <li className="shrink-0">
          <Link
            href={placeHref(place, { barberId: null })}
            className={cx(chip, "border-line text-ink border bg-white px-3.5")}
          >
            {t.barberos.todos}
          </Link>
        </li>
        {barbers.map((barber) => {
          const current = barber.id === place.barberId;
          return (
            <li key={barber.id} className="shrink-0">
              <Link
                href={placeHref(place, { barberId: barber.id })}
                aria-current={current ? "page" : undefined}
                className={cx(
                  chip,
                  "gap-1.5 pr-3 pl-1.5",
                  current
                    ? "bg-ink text-white"
                    : "border-line text-ink border bg-white",
                )}
              >
                <Avatar name={barber.name} size="sm" />
                {barber.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
