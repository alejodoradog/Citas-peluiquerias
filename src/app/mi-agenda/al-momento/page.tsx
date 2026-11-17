import type { Metadata } from "next";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { createMyWalkInAction } from "@/modulos/agenda/acciones/walk-in";
import { loadBarberAgenda } from "@/modulos/agenda/datos/barber-agenda";
import { loadMyServices } from "@/modulos/agenda/datos/walk-in";
import { walkInStart } from "@/modulos/agenda/dominio/walk-in";
import { requireProfessional } from "@/modulos/cuentas/guards";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { AccessGone } from "../../_agenda-profesional/access-gone";
import { WalkInForm } from "../../_cita-al-momento/walk-in-form";

const t = textos.citaAlMomento;

export const metadata: Metadata = {
  title: t.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// "Cita al momento" by the professional's session (task 7.7): for a customer
// who arrives without a booking. Who the professional is comes from the
// session only (my_* functions); the page sends no id to the browser but
// those of their own services.
export default function MyWalkInPage() {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <MyWalkIn />
    </Suspense>
  );
}

async function MyWalkIn() {
  await requireProfessional();
  const instant = now();
  const today = toBogotaDate(instant);
  const [agenda, services] = await Promise.all([
    loadBarberAgenda(today, today),
    loadMyServices(),
  ]);
  if (!agenda) return <AccessGone />;

  const close = { href: routes.myAgenda, label: t.cerrar };
  if (!agenda.barbershop.writable || !agenda.barber.active) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col">
        <TopBar title={t.titulo} titleAs="h1" close={close} />
        <main className="px-5">
          {agenda.barbershop.writable ? (
            <Notice tone="warning" title={t.errores.barber_inactive} />
          ) : (
            <Notice tone="warning" title={textos.barbero.pausada.titulo}>
              {textos.barbero.pausada.detalle}
            </Notice>
          )}
        </main>
      </div>
    );
  }

  return (
    <WalkInForm
      action={createMyWalkInAction}
      close={close}
      startsAt={walkInStart(instant)}
      services={services}
    />
  );
}
