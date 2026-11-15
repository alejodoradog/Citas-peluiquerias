import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { formatPesos } from "@/lib/dinero/pesos";
import { addDays, getWeekday, now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes, SAVED_PARAM } from "@/lib/routes";
import { loadDayClose } from "@/modulos/cierre/datos/day-close";
import {
  dayClose,
  parseCloseDay,
  PAUSED_WARNING,
} from "@/modulos/cierre/dominio/day-close";
import { initialsOf } from "@/ui/avatar";
import { buttonClasses } from "@/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { EmptyState, LoadingState } from "@/ui/states";
import { ScreenSuspense } from "@/ui/tap-feedback";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { CommissionForm } from "./commission-form";

const t = textos.cierre;
const a = textos.agenda;

export const metadata: Metadata = { title: t.titulo };

// "Hoy, sábado 7 de noviembre" or "Viernes 6 de noviembre".
function dayTitle(date: string, today: string): string {
  const text = a.fecha(
    a.dias[getWeekday(date)]!,
    Number(date.slice(8, 10)),
    a.meses[Number(date.slice(5, 7)) - 1]!,
  );
  return date === today
    ? a.hoy(text)
    : text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

function dayHref(date: string, today: string): string {
  return date === today
    ? routes.panelClose
    : `${routes.panelClose}?dia=${date}`;
}

// D-64 (task 4.6): what the active barbershop attended one day, by barber,
// with the barbers' commission and the CSV of "Descargar resumen". Today by
// default; ?dia= opens a past day (decision C4).
export default function DayClosePage({
  searchParams,
}: PageProps<"/panel/cierre">) {
  return (
    <ScreenSuspense fallback={<LoadingState label={t.cargando} />}>
      <DayCloseScreen searchParams={searchParams} />
    </ScreenSuspense>
  );
}

async function DayCloseScreen({
  searchParams,
}: Pick<PageProps<"/panel/cierre">, "searchParams">) {
  const { barbershop } = await requireReadyOwner();
  await connection();
  const params = await searchParams;
  const today = toBogotaDate(now());
  const date = parseCloseDay(params.dia, today);
  const data = await loadDayClose(barbershop.id, date);
  const close = dayClose(data);
  const figures = [
    { value: formatPesos(close.totalCop), label: t.totalAtendido },
    { value: String(close.servicesAttended), label: t.serviciosAtendidos },
    { value: String(close.noShows), label: t.noAsistio },
    { value: String(close.pending), label: t.pendientes },
  ];
  const arrow =
    "text-ink flex size-11 items-center justify-center rounded-full no-underline";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <TopBar
        title={t.titulo}
        titleAs="h1"
        subtitle={dayTitle(date, today)}
        back={{ href: routes.panelMore, label: t.volver }}
        action={
          <div className="flex">
            <Link
              href={dayHref(addDays(date, -1), today)}
              aria-label={t.anterior}
              className={arrow}
            >
              <ChevronLeftIcon size={20} />
            </Link>
            {date < today ? (
              <Link
                href={dayHref(addDays(date, 1), today)}
                aria-label={t.siguiente}
                className={arrow}
              >
                <ChevronRightIcon size={20} />
              </Link>
            ) : null}
          </div>
        }
      />
      <main className="flex flex-col gap-3 px-5 pt-1 pb-5">
        {params[SAVED_PARAM] ? (
          <Notice tone="success" title={t.guardado} />
        ) : null}
        {params.aviso ? (
          <Notice
            tone="danger"
            title={
              params.aviso === PAUSED_WARNING
                ? textos.suscripcion.soloLectura
                : t.noGuardado
            }
          />
        ) : null}
        <dl className="grid grid-cols-2 gap-2.5">
          {figures.map((figure) => (
            <div
              key={figure.label}
              className="border-line flex flex-col-reverse gap-0.5 rounded-[14px] border bg-white p-3.5"
            >
              <dt className="text-muted text-[13px]">{figure.label}</dt>
              <dd className="text-2xl font-bold">{figure.value}</dd>
            </div>
          ))}
        </dl>
        <h2 className="text-muted text-sm font-semibold">{t.porBarbero}</h2>
        {close.byBarber.length === 0 ? (
          <EmptyState title={t.sinAtendidos} />
        ) : (
          <ul className="border-line flex flex-col overflow-hidden rounded-2xl border bg-white">
            {close.byBarber.map((barber) => (
              <li
                key={barber.barberId}
                className="border-neutral-soft flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="bg-brand-soft text-brand-strong flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                >
                  {initialsOf(barber.name)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{barber.name}</span>
                  <span className="text-muted text-[13px]">
                    {t.atendidos(barber.attended)}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <strong>{formatPesos(barber.totalCop)}</strong>
                  <span className="text-muted text-xs">
                    {barber.commissionCop === null
                      ? t.sinComision
                      : t.comisionDe(
                          formatPesos(barber.commissionCop),
                          data.commissionPercent,
                        )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <CommissionForm date={date} percent={data.commissionPercent} />
        <a
          href={`${routes.panelCloseCsv}?dia=${date}`}
          download={t.csv.archivo(date)}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          <DownloadIcon size={18} />
          {t.descargar}
        </a>
      </main>
    </div>
  );
}
