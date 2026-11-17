import type { Metadata } from "next";
import { Suspense } from "react";
import { now } from "@/lib/fechas/fechas";
import { publicImageUrl } from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import { listBarbers, type BarberRow } from "@/modulos/barberias/datos/barbers";
import { splitBarbers } from "@/modulos/barberias/dominio/barber";
import { readAccountStates } from "@/modulos/cuentas/datos/professional-access";
import {
  accessView,
  type AccessView,
} from "@/modulos/cuentas/dominio/professional-access";
import { Avatar } from "@/ui/avatar";
import { ButtonLink } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { FlowShell } from "@/ui/flow-shell";
import { PlusIcon } from "@/ui/icons";
import { List, ListRow } from "@/ui/list";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar, TopBarAction } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { summarizeBarber } from "./barber-summary";

const t = textos.barberos;

export const metadata: Metadata = { title: t.titulo };

// D-53: the team, the active barbers first, each with the state of the
// access to their agenda (task 7.6c). A deleted professional (decision 0010,
// point 7) is no longer listed; the others are deactivated, not deleted
// (decision 1 of task 2.2).
export default function BarbersPage() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelMore, label: textos.ui.volver }}
          action={
            <TopBarAction
              href={routes.panelBarberNew}
              label={t.agregar}
              icon={<PlusIcon size={24} />}
            />
          }
        />
      }
    >
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <Barbers />
      </Suspense>
    </FlowShell>
  );
}

const addButton = (
  <ButtonLink href={routes.panelBarberNew} variant="secondary" size="md">
    <PlusIcon size={18} />
    {t.agregar}
  </ButtonLink>
);

function BarberListRow({
  barber,
  access,
}: {
  barber: BarberRow;
  access: AccessView["kind"] | null;
}) {
  return (
    <ListRow
      icon={
        <Avatar
          name={barber.display_name}
          size="md"
          photoUrl={
            barber.photo_path ? publicImageUrl(barber.photo_path) : undefined
          }
        />
      }
      title={barber.display_name}
      badge={barber.is_owner ? <Chip tone="brand">{t.tu}</Chip> : undefined}
      subtitle={summarizeBarber(barber, access)}
      trailing={
        barber.active ? undefined : <Chip tone="neutral">{t.inactivo}</Chip>
      }
      href={routes.panelBarberEdit(barber.id)}
    />
  );
}

async function Barbers() {
  const { barbershop } = await requireReadyOwner();
  // Two reads at once, never one per professional.
  const [barbers, states] = await Promise.all([
    listBarbers(barbershop.id),
    readAccountStates(barbershop.id),
  ]);
  const { active, inactive } = splitBarbers(barbers);
  const instant = now();
  const accessOf = (barber: BarberRow): AccessView["kind"] | null => {
    const status = states.get(barber.id);
    if (barber.is_owner || !status) return null;
    return accessView({
      status,
      hasEmail: (barber.email ?? "").trim() !== "",
      active: barber.active,
      now: instant,
    }).kind;
  };

  if (active.length === 0 && inactive.length === 0) {
    return (
      <EmptyState title={t.vacio.titulo} action={addButton}>
        {t.vacio.cuerpo}
      </EmptyState>
    );
  }

  return (
    <>
      {active.length > 0 ? (
        <List>
          {active.map((barber) => (
            <BarberListRow
              key={barber.id}
              barber={barber}
              access={accessOf(barber)}
            />
          ))}
        </List>
      ) : null}
      {inactive.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-label text-muted">{t.inactivos}</h2>
          <List>
            {inactive.map((barber) => (
              <BarberListRow
              key={barber.id}
              barber={barber}
              access={accessOf(barber)}
            />
            ))}
          </List>
        </section>
      ) : null}
      {addButton}
    </>
  );
}
