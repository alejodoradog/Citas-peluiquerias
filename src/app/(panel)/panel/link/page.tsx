import type { Metadata } from "next";
import { Suspense } from "react";
import { SAVED_PARAM, routes } from "@/lib/routes";
import {
  changeBookingLink,
  checkBookingLink,
} from "@/modulos/barberias/acciones/booking-link";
import { FlowShell } from "@/ui/flow-shell";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { requireReadyOwner } from "../ready-owner";
import { BookingLinkForm } from "./booking-link-form";

const t = textos.link;

export const metadata: Metadata = { title: t.titulo };

// D-61, Más › Link de reservas. "?guardado=1" is where "Cambiar link" sends
// the owner back to, to say the link changed and offer to share it.
export default function BookingLinkPage({
  searchParams,
}: PageProps<"/panel/link">) {
  return (
    <Suspense fallback={<BookingLinkLoading />}>
      <BookingLink searchParams={searchParams} />
    </Suspense>
  );
}

// Its bar, so the owner can leave, while the link loads.
function BookingLinkLoading() {
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

async function BookingLink({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [query, { barbershop }] = await Promise.all([
    searchParams,
    requireReadyOwner(),
  ]);
  // Keyed by the saved link, so the field starts from it after a change and
  // when the owner leaves a draft and comes back (FreshOnReturn).
  return (
    <FreshOnReturn>
      <BookingLinkForm
        key={barbershop.slug}
        action={changeBookingLink}
        check={checkBookingLink}
        current={barbershop.slug}
        changed={query[SAVED_PARAM] === "1"}
      />
    </FreshOnReturn>
  );
}
