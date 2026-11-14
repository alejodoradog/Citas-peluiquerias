import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  currentPlan,
  loadPlatformBarbershop,
} from "@/modulos/suscripciones/datos/platform";
import {
  PAYMENT_METHODS,
  paymentDayOptions,
} from "@/modulos/suscripciones/dominio/platform-forms";
import { paymentPreview } from "@/modulos/suscripciones/dominio/subscription";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { dayMonth, longDate, weekdayLongDate } from "../../../labels";
import { PaymentForm } from "./payment-form";

const t = textos.plataforma.pago;

export const metadata: Metadata = { title: t.titulo };

// P-03 (task 5.4): one month of the plan (decision P1), its method, the
// bank's reference and the payment day (decision P8), with "Queda activa
// hasta" worked out by the same rule as the database.
export default function PaymentPage({
  params,
}: PageProps<"/admin/barberias/[id]/pago">) {
  return (
    <Suspense fallback={<LoadingState label={textos.plataforma.cargando} />}>
      <Payment params={params} />
    </Suspense>
  );
}

async function Payment({
  params,
}: Pick<PageProps<"/admin/barberias/[id]/pago">, "params">) {
  await requireSuperAdmin();
  await connection();
  const { id } = await params;
  const today = toBogotaDate(now());
  const [shop, plan] = await Promise.all([
    loadPlatformBarbershop(id, today),
    currentPlan(),
  ]);
  if (!shop) notFound();

  // The payments that count, in the order they were registered: the new one
  // is replayed with them, as the database will do.
  const registered = shop.payments
    .filter((payment) => !payment.voided)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((payment) => ({ id: payment.id, paidOn: payment.paidOn }));
  // Each possible payment day with what it would leave, worked out here so
  // the form only picks among them.
  const days = paymentDayOptions(today).map((date) => {
    const preview = paymentPreview(shop.trialEndsOn, registered, date);
    return {
      value: date,
      label: weekdayLongDate(date),
      until: longDate(preview.until),
      explanation: preview.expiredBefore
        ? t.aTiempo(dayMonth(preview.expiredBefore))
        : t.tarde,
    };
  });

  return (
    <PaymentForm
      barbershopId={shop.id}
      barbershopName={shop.name}
      close={routes.adminBarbershop(shop.id)}
      amount={formatPesos(plan.monthlyPriceCop)}
      methods={PAYMENT_METHODS.map((method) => ({
        value: method,
        label: t.medios[method],
      }))}
      days={days}
    />
  );
}
