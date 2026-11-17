import type { Metadata } from "next";
import { Suspense } from "react";
import { yapoinWhatsapp } from "@/lib/contacto/whatsapp";
import { formatPesos } from "@/lib/dinero/pesos";
import { formatBogotaDayMonth } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { loadOwnPlan } from "@/modulos/suscripciones/datos/plan-changes";
import { PAYMENT_DETAILS } from "@/modulos/suscripciones/dominio/payment-details";
import { FlowShell } from "@/ui/flow-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { CancelRequestButton, UpgradeButton } from "./plan-actions";

const t = textos.planes.plan;

export const metadata: Metadata = { title: t.titulo };

// Task 7.8b, Más › Plan: the plan chosen, what it allows, and "Cambiar al
// plan 2". The change is a request: it applies when Yapoin registers the
// payment of the difference.
export default function PlanPage({ searchParams }: PageProps<"/panel/plan">) {
  return (
    <FlowShell header={<Header />}>
      <Suspense fallback={<LoadingState />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </FlowShell>
  );
}

function Header() {
  return (
    <TopBar
      title={t.titulo}
      titleAs="h1"
      back={{ href: routes.panelMore, label: textos.ui.volver }}
    />
  );
}

// "Paga $15.000 por llave Bre-B … o Nequi … y envía el comprobante a …".
function howToPay(valor: string): string {
  const pago = textos.suscripcion.pago;
  return pago.con(
    valor,
    pago.opcionBreB(PAYMENT_DETAILS.breB) +
      pago.o +
      pago.opcionNequi(PAYMENT_DETAILS.nequi),
    PAYMENT_DETAILS.email,
  );
}

async function Plan({
  searchParams,
}: Pick<PageProps<"/panel/plan">, "searchParams">) {
  const { barbershop } = await requireReadyOwner();
  const [plan, params] = await Promise.all([
    loadOwnPlan(barbershop.id),
    searchParams,
  ]);
  if (!plan) return <Notice tone="danger" title={t.errores.unknown} />;
  const done = typeof params.hecho === "string" ? t.hecho[params.hecho] : null;

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-6">
      {done ? <Notice tone="success" title={done} /> : null}
      <section
        aria-labelledby="plan-actual"
        className="border-line rounded-card flex flex-col gap-1 border bg-white p-4"
      >
        <h2 id="plan-actual" className="text-muted text-sm font-semibold">
          {t.actual}
        </h2>
        <p className="text-section font-bold">
          {t.nombres[plan.code] ?? plan.name}
        </p>
        <p className="text-body">
          {plan.maxProfessionals === null
            ? t.sinLimite
            : t.limite(plan.maxProfessionals)}
          {" · "}
          {t.activos(plan.activeProfessionals)}
        </p>
        <p className="text-help text-muted">
          {plan.nextPaymentCop === null
            ? t.proximoPagoAcuerdo
            : t.proximoPago(formatPesos(plan.nextPaymentCop))}
        </p>
      </section>

      {plan.pending ? (
        <Notice tone="info" title={t.pendiente.titulo}>
          <span className="flex flex-col gap-2">
            {/* What it costs now, as the platform will charge it (a monthly
                payment since asking changes it). */}
            <span>
              {t.pendiente.detalle(
                formatPesos(plan.upgradeCop ?? plan.pending.amountCop),
                formatBogotaDayMonth(plan.pending.requestedAt),
              )}
            </span>
            <span>
              {howToPay(formatPesos(plan.upgradeCop ?? plan.pending.amountCop))}
            </span>
            <CancelRequestButton requestId={plan.pending.id} />
          </span>
        </Notice>
      ) : plan.upgradeCop !== null ? (
        <section
          aria-labelledby="subir"
          className="border-line rounded-card flex flex-col gap-2 border bg-white p-4"
        >
          <h2 id="subir" className="text-base font-semibold">
            {t.subir.titulo}
          </h2>
          <p className="text-body text-muted">{t.subir.detalle}</p>
          <UpgradeButton
            amount={formatPesos(plan.upgradeCop)}
            howToPay={howToPay(formatPesos(plan.upgradeCop))}
          />
        </section>
      ) : null}

      <p className="text-help text-muted">
        {t.otro}{" "}
        <a
          href={yapoinWhatsapp(t.mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-strong inline-flex min-h-11 items-center font-semibold underline"
        >
          {t.escribenos}
        </a>
      </p>
    </div>
  );
}
