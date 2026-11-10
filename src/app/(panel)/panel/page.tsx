import type { Metadata } from "next";
import { Suspense } from "react";
import { formatBogotaDate, startOfBogotaDay } from "@/lib/fechas/fechas";
import { requireOwner } from "@/modulos/cuentas/guards";
import { AppShell } from "@/ui/app-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";

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
  const trialEnd = formatBogotaDate(startOfBogotaDay(barbershop.expiresOn));

  return (
    <>
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
