import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { addDays, now, toBogotaDate } from "@/lib/fechas/fechas";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import { loadPlatformBarbershop } from "@/modulos/suscripciones/datos/platform";
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
  const shop = await loadPlatformBarbershop(id, today);
  if (!shop) notFound();

  const state = platformState(shop, today);
  const done = (await searchParams).hecho;
  const notice = NOTICES.find((key) => key === done);
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1);
  const rows = [
    { term: t.ficha.dueno, value: shop.owner.name },
    { term: t.ficha.correo, value: shop.owner.email },
    { term: t.ficha.celular, value: shop.owner.phone },
    { term: t.ficha.link, value: `yapoin.com/${shop.slug}` },
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
    <div className="mx-auto flex w-full max-w-md flex-col">
      <TopBar
        title={shop.name}
        titleAs="h1"
        subtitle={shop.locality ?? undefined}
        back={{ href: routes.admin, label: t.ficha.volver }}
      />
      <main className="flex flex-col gap-3.5 px-5 pt-1 pb-6">
        {notice ? (
          <Notice tone="success" title={t.ficha.hecho[notice]} />
        ) : null}
        <div className="flex items-center gap-2">
          <Chip tone={STATE_TONES[state]}>{t.estados[state]}</Chip>
          <span className="text-muted text-[13px]">
            {t.ficha.venceEl(
              shortDate(shop.expiresOn),
              t.ficha.cuando(daysBetween(today, shop.expiresOn)),
            )}
          </span>
        </div>
        <dl className="border-line flex flex-col gap-2.5 rounded-2xl border bg-white p-4">
          {rows.map((row) => (
            <div key={row.term} className="flex flex-col gap-0.5">
              <dt className="text-muted text-[13px]">{row.term}</dt>
              <dd className="text-[15px] leading-[1.4] font-semibold break-words">
                {row.value ?? t.ficha.sinDato}
              </dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-3 gap-2.5">
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
        <h2 className="text-muted text-sm font-semibold">{t.ficha.pagos}</h2>
        {shop.payments.length === 0 ? (
          <p className="text-muted text-sm">{t.ficha.sinPagos}</p>
        ) : (
          <ul className="border-line flex flex-col overflow-hidden rounded-2xl border bg-white">
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
        <Link href={routes.adminPayment(shop.id)} className={buttonClasses()}>
          <DollarIcon size={20} />
          {t.ficha.registrarPago}
        </Link>
        <FichaActions
          barbershopId={shop.id}
          name={shop.name}
          inTrial={shop.subscriptionStatus === "trial"}
          suspended={shop.subscriptionStatus === "suspended"}
          trialEndsOn={shop.trialEndsOn}
          trialEndsLabel={shortDate(shop.trialEndsOn)}
          extendOptions={[3, 7, 14, 30].map((days) => ({
            days,
            until: longDate(addDays(shop.trialEndsOn, days)),
          }))}
        />
      </main>
    </div>
  );
}
