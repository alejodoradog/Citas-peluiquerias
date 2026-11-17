import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import { listPlanChanges } from "@/modulos/suscripciones/datos/plan-changes";
import {
  earliestPaymentDay,
  PAYMENT_METHODS,
  paymentDayOptions,
} from "@/modulos/suscripciones/dominio/platform-forms";
import { Notice } from "@/ui/notice";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { dayMonth, weekdayLongDate } from "../labels";
import {
  AcceptPlanChangeButton,
  RejectPlanChangeButton,
} from "../plan-change-actions";

const t = textos.plataforma;
const s = t.solicitudes;

export const metadata: Metadata = { title: s.titulo };

// Task 7.8b: the requests to change plan still pending. Each one is accepted
// only by registering the payment of its difference, or rejected.
export default function PlanChangesPage({
  searchParams,
}: PageProps<"/admin/solicitudes">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <PlanChanges searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanChanges({
  searchParams,
}: Pick<PageProps<"/admin/solicitudes">, "searchParams">) {
  await requireSuperAdmin();
  await connection();
  const [pending, params] = await Promise.all([
    listPlanChanges({ pendingOnly: true }),
    searchParams,
  ]);
  const done = typeof params.hecho === "string" ? s.hecho[params.hecho] : null;
  const today = toBogotaDate(now());
  const methods = PAYMENT_METHODS.map((method) => ({
    value: method,
    label: t.pago.medios[method],
  }));
  const name = (code: string) => textos.planes.plan.nombres[code] ?? code;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:px-6 lg:pt-4">
      <TopBar
        title={s.titulo}
        titleAs="h1"
        subtitle={s.pendientes(pending.length)}
        back={{ href: routes.admin, label: t.ficha.volver }}
      />
      <main className="flex flex-col gap-3 px-5 pt-1 pb-6">
        {done ? <Notice tone="success" title={done} /> : null}
        {pending.length === 0 ? (
          <EmptyState title={s.vacio} />
        ) : (
          <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
            {pending.map((request) => {
              const amount = formatPesos(request.amountCop);
              // Never a payment day before the request (the database checks).
              const days = paymentDayOptions(
                today,
                earliestPaymentDay(today, toBogotaDate(request.requestedAt)),
              ).map((day) => ({ value: day, label: weekdayLongDate(day) }));
              return (
                <li
                  key={request.id}
                  className="border-line flex flex-col gap-3 rounded-2xl border bg-white p-4"
                >
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={routes.adminBarbershop(request.barbershopId)}
                      className="text-ink text-[15px] font-bold"
                    >
                      {request.barbershopName}
                    </Link>
                    <span className="text-[15px]">
                      {s.cambio(
                        name(request.fromPlan),
                        name(request.toPlan),
                        amount,
                      )}
                    </span>
                    <span className="text-muted text-[13px]">
                      {s.pedida(
                        dayMonth(toBogotaDate(request.requestedAt)),
                        request.ownerName,
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <AcceptPlanChangeButton
                      requestId={request.id}
                      name={request.barbershopName}
                      amount={amount}
                      amountCop={request.amountCop}
                      methods={methods}
                      days={days}
                    />
                    <RejectPlanChangeButton
                      requestId={request.id}
                      name={request.barbershopName}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
