import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  listPlatformBarbershops,
  loadRecentPayments,
} from "@/modulos/suscripciones/datos/platform";
import {
  platformCounts,
  revenue,
} from "@/modulos/suscripciones/dominio/subscription";
import { cx } from "@/ui/cx";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { monthYear } from "../labels";

const t = textos.plataforma.metricas;

export const metadata: Metadata = { title: t.titulo };

// P-06 (task 5.4, P2): only figures that come from the payments and the state
// of each barbershop (decision P9).
export default function MetricsPage() {
  return (
    <Suspense fallback={<LoadingState label={textos.plataforma.cargando} />}>
      <Metrics />
    </Suspense>
  );
}

async function Metrics() {
  await requireSuperAdmin();
  await connection();
  const today = toBogotaDate(now());
  const [shops, payments] = await Promise.all([
    listPlatformBarbershops(),
    loadRecentPayments(today),
  ]);
  const counts = platformCounts(shops, today);
  const money = revenue(payments, today);
  const cards = [
    {
      value: counts.activas + counts.porVencer,
      label: t.activas,
      tone: "text-success",
    },
    { value: counts.prueba, label: t.prueba, tone: "text-brand-strong" },
    { value: counts.vencidas, label: t.vencidas, tone: "text-danger" },
    { value: counts.suspendidas, label: t.suspendidas, tone: "text-muted" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <TopBar
        title={t.titulo}
        titleAs="h1"
        subtitle={monthYear(today)}
        back={{ href: routes.admin, label: textos.plataforma.ficha.volver }}
      />
      <main className="flex flex-col gap-3 px-5 pt-1 pb-6">
        <dl className="grid grid-cols-2 gap-2.5">
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
        <dl className="border-line flex flex-col gap-3 rounded-2xl border bg-white px-4 py-3.5">
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
      </main>
    </div>
  );
}
