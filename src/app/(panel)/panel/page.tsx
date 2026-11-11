import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatBogotaDate, startOfBogotaDay } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { barbershopNeedsSetup } from "@/modulos/barberias/datos/setup";
import { requireOwner } from "@/modulos/cuentas/guards";
import { AppShell } from "@/ui/app-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { DeletedBarbershopNotice } from "./sedes/deleted-notice";

const t = textos.panel;

export const metadata: Metadata = { title: textos.ui.navegacion.agenda };

export default function PanelPage() {
  return (
    <AppShell bottomNav>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <OwnerHome />
      </Suspense>
    </AppShell>
  );
}

async function OwnerHome() {
  const { name, barbershop } = await requireOwner();
  // A barbershop without services has not finished the wizard (task 2.1).
  if (await barbershopNeedsSetup(barbershop.id)) {
    redirect(routes.setup);
  }
  const trialEnd = formatBogotaDate(startOfBogotaDay(barbershop.expiresOn));

  return (
    <>
      {/* After "Eliminar sede" (task 2.6b), which sede went away. */}
      <DeletedBarbershopNotice />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{t.saludo(name)}</h1>
        <p className="text-section text-brand-strong">{barbershop.name}</p>
      </div>
      <Notice tone="info" title={t.prueba(trialEnd)} />
      <dl className="flex flex-col gap-1">
        <dt className="text-label text-muted">{t.tuLink}</dt>
        <dd className="text-body font-semibold break-all">
          /{barbershop.slug}
        </dd>
      </dl>
      <p className="text-body text-muted">{t.proximo}</p>
    </>
  );
}
