import type { Metadata } from "next";
import { Suspense } from "react";
import { SAVED_PARAM, routes } from "@/lib/routes";
import { saveShopHours } from "@/modulos/barberias/acciones/shop-hours";
import { listOwnHoursBarbers } from "@/modulos/barberias/datos/barbers";
import { getBarbershopHours } from "@/modulos/barberias/datos/setup";
import { barbersOutsideShop } from "@/modulos/barberias/dominio/weekly-hours";
import { FlowShell } from "@/ui/flow-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { ShopHoursEditor } from "./shop-hours-editor";

const t = textos.horarioBarberia;

export const metadata: Metadata = { title: t.titulo };

// D-58, Más › Horario: the barbershop's week. "?guardado=1" is where
// "Guardar horario" sends the owner back to.
export default function ShopHoursPage({
  searchParams,
}: PageProps<"/panel/horario">) {
  return (
    <Suspense fallback={<ShopHoursLoading />}>
      <ShopHours searchParams={searchParams} />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the week loads.
function ShopHoursLoading() {
  return (
    <FlowShell
      header={
        <TopBar
          title={t.titulo}
          titleAs="h1"
          back={{ href: routes.panelMore, label: textos.ui.volver }}
        />
      }
    >
      <LoadingState label={t.cargando} />
    </FlowShell>
  );
}

async function ShopHours({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireReadyOwner(),
  ]);
  const [hours, ownHours] = await Promise.all([
    getBarbershopHours(barbershop.id),
    listOwnHoursBarbers(barbershop.id),
  ]);
  const outside = barbersOutsideShop(ownHours, hours).map(
    ({ id, displayName }) => ({ id, displayName }),
  );

  // The editor keeps its draft in state, seeded from these props. Keyed by
  // the saved week, it starts over from it when Next.js refreshes the page
  // after a save, instead of showing the week as it was before.
  return (
    <ShopHoursEditor
      key={JSON.stringify(hours)}
      action={saveShopHours}
      hours={hours}
      saved={query[SAVED_PARAM] === "1"}
      outside={outside}
    />
  );
}
