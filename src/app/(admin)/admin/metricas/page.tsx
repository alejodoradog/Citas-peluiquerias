import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  listPlatformBarbershops,
  loadBusinessTypes,
  loadMonthlyRevenue,
  loadRecentPayments,
  loadWeeklyActivity,
} from "@/modulos/suscripciones/datos/platform";
import {
  chartBars,
  type ChartPoint,
} from "@/modulos/suscripciones/dominio/platform-metrics";
import {
  metricCounts,
  revenue,
} from "@/modulos/suscripciones/dominio/subscription";
import { cx } from "@/ui/cx";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { dayMonth, monthYear, shortMonth } from "../labels";
import { BarChart, type Bar } from "./bar-chart";

const t = textos.plataforma.metricas;
const tipos = textos.cuentas.registro.tipos;

export const metadata: Metadata = { title: t.titulo };

// P-06 (task 5.4, P2): only figures that come from the payments and the state
// of each establishment (decision P9). Task 7.12 adds, counted by the
// database: sign-ups and appointments by week, income by month, and the
// establishments by kind (decision D10, provisional).
export default function MetricsPage() {
  return (
    <Suspense fallback={<LoadingState label={textos.plataforma.cargando} />}>
      <Metrics />
    </Suspense>
  );
}

// Each bar of a series. Under the chart, one week of every 4 is named
// (counted back from this one, so it fits on a phone); every month is.
function bars(
  points: ChartPoint[],
  label: (point: ChartPoint) => { tick: string; period: string },
  value: (n: number) => string,
  tickEvery: number,
): Bar[] {
  return chartBars(points).map((bar, i, all) => {
    const names = label(bar);
    return {
      key: bar.start,
      share: bar.share,
      tick: (all.length - 1 - i) % tickEvery === 0 ? names.tick : "",
      period: names.period,
      value: value(bar.value),
    };
  });
}

const week = (point: ChartPoint) => ({
  tick: dayMonth(point.start),
  period: t.semanaDel(dayMonth(point.start)),
});

const month = (point: ChartPoint) => ({
  tick: shortMonth(point.start),
  period: monthYear(point.start),
});

async function Metrics() {
  await requireSuperAdmin();
  await connection();
  const today = toBogotaDate(now());
  const [shops, payments, weekly, monthly, kinds] = await Promise.all([
    listPlatformBarbershops(),
    loadRecentPayments(today),
    loadWeeklyActivity(),
    loadMonthlyRevenue(),
    loadBusinessTypes(),
  ]);
  const counts = metricCounts(shops, today);
  const money = revenue(payments, today);
  const cards = [
    {
      value: counts.activas,
      label: t.activas,
      tone: "text-success",
    },
    { value: counts.prueba, label: t.prueba, tone: "text-brand-strong" },
    { value: counts.vencidas, label: t.vencidas, tone: "text-danger" },
    { value: counts.suspendidas, label: t.suspendidas, tone: "text-muted" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:px-6 lg:pt-4">
      <TopBar
        title={t.titulo}
        titleAs="h1"
        subtitle={monthYear(today)}
        back={{ href: routes.admin, label: textos.plataforma.ficha.volver }}
      />
      <main className="flex flex-col gap-3 px-5 pt-1 pb-6 lg:gap-5">
        <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="border-line flex flex-col-reverse gap-0.5 rounded-2xl border bg-white px-4 py-3.5"
            >
              <dt className="text-muted text-sm">{card.label}</dt>
              <dd
                className={cx("text-[28px] leading-tight font-bold", card.tone)}
              >
                {card.value}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="border-line flex flex-col gap-3 rounded-2xl border bg-white px-4 py-3.5 lg:flex-row lg:gap-10">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t.ingresoMes}</dt>
            <dd className="text-base font-bold">
              {t.delMes(formatPesos(money.month.totalCop), money.month.count)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted text-sm">{t.mesAnterior}</dt>
            <dd className="text-base font-bold">
              {t.anterior(
                formatPesos(money.previous.totalCop),
                money.previous.count,
              )}
            </dd>
          </div>
        </dl>

        <p className="text-muted text-[13px]">{t.cuando}</p>
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
          <BarChart
            title={t.registros.titulo}
            subtitle={t.registros.bajada}
            periodHead={t.semana}
            valueHead={t.registros.columna}
            bars={bars(weekly.signups, week, t.registros.unidad, 4)}
          />
          <BarChart
            title={t.citas.titulo}
            subtitle={t.citas.bajada}
            periodHead={t.semana}
            valueHead={t.citas.columna}
            bars={bars(weekly.appointments, week, t.citas.unidad, 4)}
          />
          <BarChart
            title={t.ingresos.titulo}
            subtitle={t.ingresos.bajada}
            periodHead={t.mes}
            valueHead={t.ingresos.columna}
            bars={bars(monthly, month, formatPesos, 1)}
          />
          <section
            aria-labelledby="por-tipo"
            className="border-line flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 lg:p-5"
          >
            <div className="flex flex-col gap-0.5">
              <h2 id="por-tipo" className="text-base font-bold lg:text-lg">
                {t.porTipo.titulo}
              </h2>
              <p className="text-muted text-[13px]">{t.porTipo.bajada}</p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-muted text-left">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    {t.porTipo.tipo}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right font-semibold"
                  >
                    {t.porTipo.establecimientos}
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-3 text-right font-semibold"
                  >
                    {t.porTipo.citas}
                  </th>
                </tr>
              </thead>
              <tbody>
                {kinds.map((kind) => (
                  <tr
                    key={kind.kind ?? "sin-tipo"}
                    className="border-neutral-soft border-t"
                  >
                    <td className="py-2 pr-3">
                      {kind.kind ? tipos[kind.kind] : t.porTipo.sinTipo}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {kind.establishments}
                    </td>
                    <td className="py-2 pl-3 text-right font-semibold tabular-nums">
                      {kind.recentAppointments.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}
