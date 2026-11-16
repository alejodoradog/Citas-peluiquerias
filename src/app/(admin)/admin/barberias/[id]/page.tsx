import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { addDays, now, toBogotaDate } from "@/lib/fechas/fechas";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  loadPlatformBarbershop,
  loadQuote,
} from "@/modulos/suscripciones/datos/platform";
import { EXTEND_DAYS } from "@/modulos/suscripciones/dominio/platform-forms";
import { platformState } from "@/modulos/suscripciones/dominio/subscription";
import { buttonClasses } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { DollarIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import {
  dayMonth,
  daysBetween,
  longDate,
  shortDate,
  shortMonth,
  STATE_TONES,
} from "../../labels";
import { FichaActions, VoidPaymentButton } from "./ficha-actions";

const t = textos.plataforma;

export const metadata: Metadata = { title: textos.admin.titulo };

const NOTICES = [
  "pago",
  "anulado",
  "suspendida",
  "reactivada",
  "extendida",
] as const;

// P-02 (task 5.4): one barbershop, its owner, its numbers and its payments,
// with registering a payment (P-03), extending the trial (P-04), suspending
// (P-05), Reactivar and voiding a payment (decisions P4 and P5).
export default function BarbershopPage({
  params,
  searchParams,
}: PageProps<"/admin/barberias/[id]">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <Barbershop params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Barbershop({
  params,
  searchParams,
}: Pick<PageProps<"/admin/barberias/[id]">, "params" | "searchParams">) {
  await requireSuperAdmin();
  await connection();
  const { id } = await params;
  const today = toBogotaDate(now());
  const [shop, quote] = await Promise.all([
    loadPlatformBarbershop(id, today),
    loadQuote(id),
  ]);
  if (!shop) notFound();

  const state = platformState(shop, today);
  // P-04 counts from the end of the trial, or from today if it ended
  // (decision P3), as extendTrial does.
  const extendFrom = shop.trialEndsOn > today ? shop.trialEndsOn : today;
  const done = (await searchParams).hecho;
  const notice = NOTICES.find((key) => key === done);
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1);
  const rows = [
    { term: t.ficha.dueno, value: shop.owner.name },
    { term: t.ficha.correo, value: shop.owner.email },
    { term: t.ficha.celular, value: shop.owner.phone },
    { term: t.ficha.link, value: `yapoin.com/${shop.slug}` },
    // Task 5.6: what it pays by its active barbers.
    {
      term: t.ficha.plan,
      value: quote
        ? t.ficha.planValor(
            quote.planName,
            quote.priceCop === null ? null : formatPesos(quote.priceCop),
          )
        : null,
    },
  ];
  const numbers = [
    {
      value: String(shop.appointmentsLastMonth),
      label: t.ficha.citasEn(shortMonth(lastMonth)),
    },
    { value: String(shop.activeBarbers), label: t.ficha.barberos },
    { value: dayMonth(toBogotaDate(shop.createdAt)), label: t.ficha.registro },
  ];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:px-6 lg:pt-4">
      <TopBar
        title={shop.name}
        titleAs="h1"
        subtitle={shop.locality ?? undefined}
        back={{ href: routes.admin, label: t.ficha.volver }}
      />
      {/* On a computer (task 7.12) two columns: the state, the numbers and
          the payments; beside them the details and the actions. On a phone
          the columns dissolve (contents) and the order is the design's. */}
      <main className="flex flex-col gap-3.5 px-5 pt-1 pb-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {notice ? (
          <div className="lg:col-span-2">
            <Notice tone="success" title={t.ficha.hecho[notice]} />
          </div>
        ) : null}
        <div className="contents lg:flex lg:flex-col lg:gap-3.5">
          <div className="order-1 flex items-center gap-2 lg:order-none">
            <Chip tone={STATE_TONES[state]}>{t.estados[state]}</Chip>
            <span className="text-muted text-[13px]">
              {t.ficha.venceEl(
                shortDate(shop.expiresOn),
                t.ficha.cuando(daysBetween(today, shop.expiresOn)),
              )}
            </span>
          </div>
          <dl className="order-3 grid grid-cols-3 gap-2.5 lg:order-none">
            {numbers.map((number) => (
              <div
                key={number.label}
                className="border-line flex flex-col-reverse gap-0.5 rounded-[14px] border bg-white p-3"
              >
                <dt className="text-muted text-xs">{number.label}</dt>
                <dd className="text-xl font-bold">{number.value}</dd>
              </div>
            ))}
          </dl>
          <h2 className="text-muted order-4 text-sm font-semibold lg:order-none">
            {t.ficha.pagos}
          </h2>
          {shop.payments.length === 0 ? (
            <p className="text-muted order-5 text-sm lg:order-none">
              {t.ficha.sinPagos}
            </p>
          ) : (
            <ul className="border-line order-5 flex flex-col overflow-hidden rounded-2xl border bg-white lg:order-none">
              {shop.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="border-neutral-soft text-ink flex min-h-13 items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cx(
                        "text-[15px] font-semibold",
                        payment.voided && "text-muted line-through",
                      )}
                    >
                      {t.ficha.pagoLinea(
                        shortDate(payment.paidOn),
                        formatPesos(payment.amountCop),
                      )}
                    </span>
                    <span className="text-muted text-[13px] leading-[1.35]">
                      {payment.voided
                        ? t.ficha.anulado(payment.voided.reason)
                        : t.ficha.pagoDetalle(payment.reference)}
                    </span>
                  </span>
                  {payment.voided ? null : (
                    <VoidPaymentButton
                      barbershopId={shop.id}
                      paymentId={payment.id}
                      label={t.ficha.anularDe(longDate(payment.paidOn))}
                      detail={t.anular.detalle(
                        longDate(payment.paidOn),
                        formatPesos(payment.amountCop),
                      )}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-3.5">
          <dl className="border-line order-2 flex flex-col gap-2.5 rounded-2xl border bg-white p-4 lg:order-none">
            {rows.map((row) => (
              <div key={row.term} className="flex flex-col gap-0.5">
                <dt className="text-muted text-[13px]">{row.term}</dt>
                <dd className="text-[15px] leading-[1.4] font-semibold break-words">
                  {row.value ?? t.ficha.sinDato}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href={routes.adminPayment(shop.id)}
            className={cx(buttonClasses(), "order-6 lg:order-none")}
          >
            <DollarIcon size={20} />
            {t.ficha.registrarPago}
          </Link>
          <div className="order-7 lg:order-none">
            <FichaActions
              barbershopId={shop.id}
              name={shop.name}
              inTrial={shop.subscriptionStatus === "trial"}
              suspended={shop.subscriptionStatus === "suspended"}
              trialEndsLabel={shortDate(shop.trialEndsOn)}
              extendOptions={EXTEND_DAYS.map((days) => ({
                days,
                until: longDate(addDays(extendFrom, days)),
              }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
