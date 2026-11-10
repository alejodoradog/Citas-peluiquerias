import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import { listServices } from "@/modulos/barberias/datos/services";
import { splitServices } from "@/modulos/barberias/dominio/service";
import { ButtonLink } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { FlowShell } from "@/ui/flow-shell";
import { PlusIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar, TopBarAction } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";

const t = textos.servicios;

export const metadata: Metadata = { title: t.titulo };

// D-51: the barbershop's services, the active ones first. Services are never
// deleted, only deactivated (decision 1 of task 2.2).
export default function ServicesPage() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelMore, label: textos.ui.volver }}
          action={
            <TopBarAction
              href={routes.panelServiceNew}
              label={t.agregar}
              icon={<PlusIcon size={24} />}
            />
          }
        />
      }
    >
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <Services />
      </Suspense>
    </FlowShell>
  );
}

const addButton = (
  <ButtonLink href={routes.panelServiceNew} variant="secondary" size="md">
    <PlusIcon size={18} />
    {t.agregar}
  </ButtonLink>
);

async function Services() {
  const { barbershop } = await requireReadyOwner();
  const { active, inactive } = splitServices(await listServices(barbershop.id));

  if (active.length === 0 && inactive.length === 0) {
    return (
      <EmptyState title={t.vacio.titulo} action={addButton}>
        {t.vacio.cuerpo}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="text-label text-muted leading-[1.45] font-normal">
        {t.bajada}
      </p>
      {active.length > 0 ? (
        <List>
          {active.map((service) => (
            <ListRow
              key={service.id}
              title={service.name}
              subtitle={t.duracion(service.duration_minutes)}
              trailing={
                <strong className="text-body">
                  {formatPesos(service.price_cop)}
                </strong>
              }
              href={routes.panelServiceEdit(service.id)}
            />
          ))}
        </List>
      ) : null}
      {inactive.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-label text-muted">{t.inactivos}</h2>
          <List>
            {inactive.map((service) => (
              <ListRow
                key={service.id}
                title={service.name}
                subtitle={t.detalle(
                  t.duracion(service.duration_minutes),
                  formatPesos(service.price_cop),
                )}
                trailing={<Chip tone="neutral">{t.inactivo}</Chip>}
                href={routes.panelServiceEdit(service.id)}
              />
            ))}
          </List>
        </section>
      ) : null}
      {addButton}
    </>
  );
}
