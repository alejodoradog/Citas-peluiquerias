import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { now } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  countCustomers,
  listCustomers,
  type CustomerListRow,
} from "@/modulos/clientes/datos/customers";
import {
  CUSTOMER_FILTERS,
  customerListHref,
  DELETED_PARAM,
  FILTER_PARAM,
  LIST_LIMIT,
  listActivity,
  MAX_SEARCH_LENGTH,
  readCustomerListParams,
  SEARCH_PARAM,
  type CustomerFilter,
} from "@/modulos/clientes/dominio/customers";
import { Avatar } from "@/ui/avatar";
import { ButtonLink } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { cx } from "@/ui/cx";
import { SearchIcon, UsersIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { Notice } from "@/ui/notice";
import { EmptyState, LoadingState } from "@/ui/states";
import { TabShell } from "@/ui/tab-shell";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../ready-owner";
import { shortDay, timeOf } from "./format";

const t = textos.clientes;

export const metadata: Metadata = { title: t.titulo };

// D-40 (task 4.3): the barbershop's customers, with a search by name, email
// or phone and the filters Todos, Con inasistencias and Nuevos, both in the
// URL (?q=…&filtro=…) so the list can be shared and comes back as it was.
export default function CustomersPage({
  searchParams,
}: PageProps<"/panel/clientes">) {
  return (
    <Suspense
      fallback={
        <TabShell title={t.titulo}>
          <LoadingState label={t.cargando} />
        </TabShell>
      }
    >
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

const filterLabels: Record<CustomerFilter, string> = {
  todos: t.filtros.todos,
  inasistencias: t.filtros.inasistencias,
  nuevos: t.filtros.nuevos,
};

async function Customers({
  searchParams,
}: Pick<PageProps<"/panel/clientes">, "searchParams">) {
  const [{ barbershop }, params] = await Promise.all([
    requireReadyOwner(),
    searchParams,
  ]);
  const { search, filter } = readCustomerListParams(params);
  const deleted = params[DELETED_PARAM] === "1";
  // Always live: the "hoy" of each row runs with the clock.
  await connection();
  const [total, list] = await Promise.all([
    countCustomers(barbershop.id),
    listCustomers(barbershop.id, { search, filter }),
  ]);
  const instant = now();

  return (
    <TabShell title={t.titulo} subtitle={t.total(total)}>
      {deleted ? <Notice tone="success" title={t.borrado} /> : null}
      {total > 0 ? (
        <>
          <Search search={search} filter={filter} />
          <Filters search={search} current={filter} />
        </>
      ) : null}
      {list.rows.length > 0 ? (
        <List>
          {list.rows.map((customer) => (
            <CustomerRow key={customer.id} customer={customer} now={instant} />
          ))}
        </List>
      ) : total === 0 ? (
        <EmptyState icon={<UsersIcon size={32} />} title={t.vacio.titulo}>
          {t.vacio.cuerpo}
        </EmptyState>
      ) : (
        <EmptyState
          title={t.sinResultados.titulo}
          action={
            <ButtonLink
              href={routes.panelClients}
              variant="secondary"
              size="md"
            >
              {t.sinResultados.verTodos}
            </ButtonLink>
          }
        >
          {search ? t.sinResultados.busqueda(search) : t.sinResultados.filtro}
        </EmptyState>
      )}
      {list.more ? (
        <p className="text-help text-muted">{t.mas(LIST_LIMIT)}</p>
      ) : null}
    </TabShell>
  );
}

// A GET form: the search goes into the URL with the current filter, and
// Next.js navigates to it without a full page load.
function Search({
  search,
  filter,
}: {
  search: string;
  filter: CustomerFilter;
}) {
  return (
    <Form action={routes.panelClients} role="search">
      <div className="rounded-field border-line text-muted focus-within:border-brand flex h-12.5 items-center gap-2 border bg-white px-3.5">
        <SearchIcon size={18} />
        <label htmlFor="buscar-cliente" className="sr-only">
          {t.buscar.etiqueta}
        </label>
        <input
          id="buscar-cliente"
          type="search"
          name={SEARCH_PARAM}
          defaultValue={search}
          placeholder={t.buscar.placeholder}
          enterKeyHint="search"
          autoComplete="off"
          maxLength={MAX_SEARCH_LENGTH}
          className="text-ink min-w-0 flex-1 self-stretch border-0 bg-transparent text-base"
        />
        {filter !== "todos" ? (
          <input type="hidden" name={FILTER_PARAM} value={filter} />
        ) : null}
      </div>
    </Form>
  );
}

// The filters of D-40, as links: each keeps the search. The pill is 36 px
// as the design draws it, inside a 44 px tall touch target (F-01).
function Filters({
  search,
  current,
}: {
  search: string;
  current: CustomerFilter;
}) {
  return (
    <nav aria-label={t.filtros.etiqueta}>
      <ul className="flex flex-wrap gap-x-2">
        {CUSTOMER_FILTERS.map((filter) => {
          const active = filter === current;
          return (
            <li key={filter}>
              <Link
                href={customerListHref(routes.panelClients, { search, filter })}
                aria-current={active ? "true" : undefined}
                className="flex min-h-11 items-center no-underline"
              >
                <span
                  data-filter={filter}
                  className={cx(
                    "text-help flex h-9 items-center rounded-full border px-3 font-semibold",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line text-ink bg-white",
                  )}
                >
                  {filterLabels[filter]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CustomerRow({
  customer,
  now: instant,
}: {
  customer: CustomerListRow;
  now: Date;
}) {
  const activity = listActivity(customer);
  const detail =
    activity.kind === "next"
      ? t.proxima(shortDay(activity.at, instant), timeOf(activity.at))
      : activity.kind === "noEmail"
        ? t.sinCorreo
        : activity.kind === "last"
          ? t.ultima(shortDay(activity.at, instant))
          : null;
  const visits = t.visitas(customer.visits);

  return (
    <ListRow
      icon={<Avatar name={customer.fullName} size="md" />}
      title={customer.fullName}
      subtitle={detail ? `${visits} · ${detail}` : visits}
      trailing={
        customer.noShows > 0 ? (
          <Chip tone="danger">{t.inasistencias(customer.noShows)}</Chip>
        ) : undefined
      }
      href={routes.panelClient(customer.id)}
    />
  );
}
