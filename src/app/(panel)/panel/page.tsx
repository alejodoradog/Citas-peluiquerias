import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/access";
import { formatBogotaDate, startOfBogotaDay } from "@/lib/fechas/fechas";
import { AppShell } from "@/ui/app-shell";
import { textos } from "@/ui/textos";

const t = textos.panel;

export const metadata: Metadata = { title: textos.cuentas.marca };

export default function PanelPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-muted">{t.cargando}</p>}>
        <OwnerHome />
      </Suspense>
    </AppShell>
  );
}

async function OwnerHome() {
  const { ownerName, barbershop } = await requireOwner();
  const trialEnd = formatBogotaDate(startOfBogotaDay(barbershop.expiresOn));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance">
          {t.saludo(ownerName)}
        </h1>
        <p className="text-brand-strong mt-2 text-xl font-semibold">
          {barbershop.name}
        </p>
      </div>
      <p className="border-brand border-l-4 bg-white px-4 py-3 text-base">
        {t.prueba(trialEnd)}
      </p>
      <dl className="flex flex-col gap-1">
        <dt className="text-muted text-sm font-semibold">{t.tuLink}</dt>
        <dd className="text-base font-semibold break-all">
          /{barbershop.slug}
        </dd>
      </dl>
      <p className="text-muted text-base leading-relaxed">{t.proximo}</p>
    </div>
  );
}
