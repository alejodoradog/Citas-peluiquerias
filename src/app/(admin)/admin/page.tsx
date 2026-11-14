import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import { listPlatformBarbershops } from "@/modulos/suscripciones/datos/platform";
import {
  filterOf,
  PLATFORM_FILTERS,
  platformCounts,
  platformState,
  type PlatformFilter,
} from "@/modulos/suscripciones/dominio/subscription";
import { Chip } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { BarChartIcon, SearchIcon } from "@/ui/icons";
import { SignOutButton } from "@/ui/sign-out-button";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { shortDate, STATE_TONES } from "./labels";

const t = textos.plataforma;

export const metadata: Metadata = { title: textos.admin.titulo };

// P-01 (task 5.4): every barbershop of the platform with its state, the
// search (barbershop, owner or email) and the filters by state, all in the
// URL (?q= and ?estado=) so going back keeps them.
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <Barbershops searchParams={searchParams} />
    </Suspense>
  );
}

function filterParam(value: unknown): PlatformFilter {
  return typeof value === "string" &&
    (PLATFORM_FILTERS as readonly string[]).includes(value)
    ? (value as PlatformFilter)
    : "todas";
}

function href(query: { q?: string; estado?: PlatformFilter }): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.estado && query.estado !== "todas")
    params.set("estado", query.estado);
  const search = params.toString();
  return search ? `${routes.admin}?${search}` : routes.admin;
}

async function Barbershops({
  searchParams,
}: Pick<PageProps<"/admin">, "searchParams">) {
  await requireSuperAdmin();
  await connection();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const estado = filterParam(params.estado);
  const today = toBogotaDate(now());

  const shops = await listPlatformBarbershops(q || undefined);
  const counts = platformCounts(shops, today);
  const shown = shops
    .map((shop) => ({ shop, state: platformState(shop, today) }))
    .filter(({ state }) => estado === "todas" || filterOf(state) === estado);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <header className="flex min-h-14 items-center gap-1 px-3 pt-2.5 pb-1.5">
        <div className="w-2 shrink-0" />
        <h1 className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold">{t.titulo}</span>
          <span className="text-muted text-xs font-normal">
            {textos.admin.titulo}
          </span>
        </h1>
        <Link
          href={routes.adminMetrics}
          aria-label={t.verMetricas}
          className="text-ink flex size-11 items-center justify-center rounded-full no-underline"
        >
          <BarChartIcon size={22} />
        </Link>
      </header>
      <main className="flex flex-col gap-3 px-5 pt-1 pb-5">
        <form
          action={routes.admin}
          role="search"
          className="border-line text-muted focus-within:border-brand focus-within:outline-brand flex h-13 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:outline-2"
        >
          <SearchIcon size={20} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label={t.buscar.etiqueta}
            placeholder={t.buscar.placeholder}
            maxLength={100}
            className="text-ink h-full min-w-0 flex-1 self-stretch bg-transparent text-base outline-none"
          />
        </form>
        <ul
          aria-label={t.filtros.etiqueta}
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
        >
          {PLATFORM_FILTERS.map((filter) => {
            const current = filter === estado;
            return (
              <li key={filter} className="shrink-0">
                <Link
                  href={href({ q, estado: filter })}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    // 44 px tall, the design's 36 grown for F-01's touch targets.
                    "flex min-h-11 items-center rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap no-underline",
                    current
                      ? "border-ink bg-ink text-white"
                      : "border-line text-ink bg-white",
                  )}
                >
                  {t.filtros.conteo(t.filtros[filter], counts[filter])}
                </Link>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 ? (
          <EmptyState title={q ? t.sinResultados : t.sinBarberias} />
        ) : (
          <ul className="border-line flex flex-col overflow-hidden rounded-2xl border bg-white">
            {shown.map(({ shop, state }) => (
              <li
                key={shop.id}
                className="border-neutral-soft border-b last:border-b-0"
              >
                <Link
                  href={routes.adminBarbershop(shop.id)}
                  className="text-ink flex flex-col gap-1.5 px-4 py-3.5 no-underline"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold">{shop.name}</span>
                    <Chip tone={STATE_TONES[state]}>{t.estados[state]}</Chip>
                  </span>
                  <span className="text-muted text-[13px]">
                    {t.linea(shop.locality, shortDate(shop.expiresOn))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-center pt-2">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
