import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSuperAdmin } from "@/modulos/cuentas/guards";
import { AppShell } from "@/ui/app-shell";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";

const t = textos.admin;

export const metadata: Metadata = { title: t.titulo };

export default function AdminPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <AdminHome />
      </Suspense>
    </AppShell>
  );
}

async function AdminHome() {
  const { name } = await requireSuperAdmin();
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{t.titulo}</h1>
        <p className="text-section">{t.saludo(name)}</p>
      </div>
      <p className="text-body text-muted">{t.proximo}</p>
    </>
  );
}
