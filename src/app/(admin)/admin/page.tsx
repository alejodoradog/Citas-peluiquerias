import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import {
  listPlatformBarbershops,
  type PlatformRow,
} from "@/modulos/suscripciones/datos/platform";
import {
  nextSort,
  readSort,
  SORT_KEYS,
  sortParam,
  sortRows,
  type SortKey,
  type TableSort,
} from "@/modulos/suscripciones/dominio/platform-table";
import {
  filterOf,
  PLATFORM_FILTERS,
  platformCounts,
  platformState,
  type PlatformFilter,
  type PlatformState,
} from "@/modulos/suscripciones/dominio/subscription";
import { Chip } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { BarChartIcon, SearchIcon } from "@/ui/icons";
import { SignOutButton } from "@/ui/sign-out-button";
import { EmptyState, LoadingState } from "@/ui/states";
import { ScreenSuspense } from "@/ui/tap-feedback";
import { textos } from "@/ui/textos";
import { shortDate, STATE_TONES } from "./labels";

const t = textos.plataforma;
const tipos = textos.cuentas.registro.tipos;

export const metadata: Metadata = { title: textos.admin.titulo };

// P-01 (task 5.4): every establishment of the platform with its state, the
// search (establishment, owner or email) and the filters by state, all in the
// URL (?q=, ?estado= and, on a computer, ?orden=) so going back keeps them.
// On a phone it is the list of the design; from 1024 px wide, a table that
// sorts by any column (task 7.12).
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <ScreenSuspense fallback={<LoadingState label={t.cargando} />}>
      <Barbershops searchParams={searchParams} />
    </ScreenSuspense>
  );
}

function filterParam(value: unknown): PlatformFilter {
  return typeof value === "string" &&
    (PLATFORM_FILTERS as readonly string[]).includes(value)
    ? (value as PlatformFilter)
    : "todas";
}

function href(query: {
  q?: string;
  estado?: PlatformFilter;
  orden?: TableSort | null;
}): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.estado && query.estado !== "todas")
    params.set("estado", query.estado);
  if (query.orden) params.set("orden", sortParam(query.orden));
  const search = params.toString();
  return search ? `${routes.admin}?${search}` : routes.admin;
}

// "Barbería" or "Otro: uñas"; "Sin tipo" before task 7.2.
function kindOf(shop: PlatformRow): string {
  if (!shop.businessType) return t.tabla.sinTipo;
  const { kind, other } = shop.businessType;
  return kind === "other" && other ? t.tabla.otro(other) : tipos[kind];
}

async function Barbershops({
  searchParams,
}: Pick<PageProps<"/admin">, "searchParams">) {
  await requireSuperAdmin();
  await connection();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const estado = filterParam(params.estado);
  const orden = readSort(params.orden);
  const today = toBogotaDate(now());

  const shops = await listPlatformBarbershops(q || undefined);
  const counts = platformCounts(shops, today);
  const shown = shops
    .map((shop) => ({ shop, state: platformState(shop, today) }))
    .filter(({ state }) => estado === "todas" || filterOf(state) === estado);
  const sorted = sortRows(
    shown.map(({ shop, state }) => ({
      shop,
      state,
      name: shop.name,
      ownerName: shop.owner.name,
      locality: shop.locality,
      expiresOn: shop.expiresOn,
      createdAt: shop.createdAt,
    })),
    orden,
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col lg:max-w-6xl lg:px-6 lg:pt-4">
      <header className="flex min-h-14 items-center gap-1 px-3 pt-2.5 pb-1.5 lg:px-5">
        <div className="w-2 shrink-0 lg:hidden" />
        <h1 className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold lg:text-[1.75rem] lg:font-extrabold">
            {t.titulo}
          </span>
          <span className="text-muted text-xs font-normal lg:hidden">
            {textos.admin.titulo}
          </span>
          <span className="text-muted hidden text-sm font-normal lg:inline">
            {t.tabla.total(shops.length)}
          </span>
        </h1>
        <Link
          href={routes.adminMetrics}
          aria-label={t.verMetricas}
          className="text-ink flex size-11 items-center justify-center rounded-full no-underline lg:hidden"
        >
          <BarChartIcon size={22} />
        </Link>
      </header>
      <main className="flex flex-col gap-3 px-5 pt-1 pb-5">
        <form
          action={routes.admin}
          role="search"
          className="border-line text-muted focus-within:border-brand focus-within:outline-brand flex h-13 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:outline-2 lg:max-w-sm"
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
          {orden ? (
            <input type="hidden" name="orden" value={sortParam(orden)} />
          ) : null}
        </form>
        <ul
          aria-label={t.filtros.etiqueta}
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {PLATFORM_FILTERS.map((filter) => {
            const current = filter === estado;
            return (
              <li key={filter} className="shrink-0">
                <Link
                  href={href({ q, estado: filter, orden })}
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
        {sorted.length === 0 ? (
          <EmptyState title={q ? t.sinResultados : t.sinBarberias} />
        ) : (
          <>
            <ul className="border-line flex flex-col overflow-hidden rounded-2xl border bg-white lg:hidden">
              {sorted.map(({ shop, state }) => (
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
            <Table
              rows={sorted}
              orden={orden}
              link={(o) => href({ q, estado, orden: o })}
            />
            <p className="text-muted hidden text-[13px] lg:block">
              {t.tabla.ayuda}
            </p>
          </>
        )}
        <div className="flex justify-center pt-2 lg:hidden">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}

function Table({
  rows,
  orden,
  link,
}: {
  rows: { shop: PlatformRow; state: PlatformState }[];
  orden: TableSort | null;
  link: (orden: TableSort) => string;
}) {
  const c = t.tabla.columnas;
  return (
    <div className="border-line hidden overflow-x-auto rounded-2xl border bg-white lg:block">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {SORT_KEYS.map((key) => (
              <SortHeader
                key={key}
                label={c[key]}
                sortKey={key}
                orden={orden}
                href={link(nextSort(orden, key))}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ shop, state }) => (
            <tr
              key={shop.id}
              className="border-neutral-soft hover:bg-paper border-b last:border-b-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={routes.adminBarbershop(shop.id)}
                  className="text-ink flex flex-col gap-0.5 no-underline"
                >
                  <span className="text-[15px] font-bold">{shop.name}</span>
                  <span className="text-muted text-xs">
                    {kindOf(shop)} · yapoin.com/{shop.slug}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-col gap-0.5">
                  <span>{shop.owner.name ?? t.ficha.sinDato}</span>
                  <span className="text-muted text-xs break-all">
                    {shop.owner.email ?? t.ficha.sinDato}
                  </span>
                </span>
              </td>
              <td className="text-muted px-4 py-3">
                {shop.locality ?? t.ficha.sinDato}
              </td>
              <td className="px-4 py-3">
                <Chip tone={STATE_TONES[state]}>{t.estados[state]}</Chip>
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {shortDate(shop.expiresOn)}
              </td>
              <td className="text-muted px-4 py-3 whitespace-nowrap tabular-nums">
                {shortDate(toBogotaDate(shop.createdAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  orden,
  href: to,
}: {
  label: string;
  sortKey: SortKey;
  orden: TableSort | null;
  href: string;
}) {
  const current = orden?.key === sortKey ? orden : null;
  return (
    <th
      scope="col"
      aria-sort={
        current ? (current.descending ? "descending" : "ascending") : "none"
      }
      className="text-muted px-2 font-semibold whitespace-nowrap"
    >
      <Link
        href={to}
        className="hover:text-ink inline-flex min-h-11 items-center gap-1 px-2 text-inherit no-underline"
      >
        {label}
        {current ? (
          <span className="text-brand text-[11px]">
            <span aria-hidden="true">{current.descending ? "▼" : "▲"}</span>
            <span className="sr-only">
              {current.descending ? t.tabla.ordenadoDesc : t.tabla.ordenadoAsc}
            </span>
          </span>
        ) : null}
      </Link>
    </th>
  );
}
