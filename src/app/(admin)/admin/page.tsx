import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import { AppShell } from "@/ui/app-shell";
import { textos } from "@/ui/textos";

const t = textos.admin;

export const metadata: Metadata = { title: t.titulo };

export default function AdminPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-muted">{t.cargando}</p>}>
        <AdminHome />
      </Suspense>
    </AppShell>
  );
}

async function AdminHome() {
  const { name } = await requireSuperAdmin();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight">
        {t.titulo}
      </h1>
      <p className="text-lg font-semibold">{t.saludo(name)}</p>
      <p className="text-muted text-base leading-relaxed">{t.proximo}</p>
    </div>
  );
}
