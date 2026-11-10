import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { requireOwner } from "@/modulos/cuentas/guards";
import { AppShell } from "@/ui/app-shell";
import { ButtonLink } from "@/ui/button";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";

const t = textos.panel;

// A section of the bottom bar whose screens arrive in a later task: Clientes
// (4.3), Compartir (2.5) and Más (2.5). Only owners reach it.
export function ComingSoon({ title }: { title: string }) {
  return (
    <AppShell bottomNav>
      <h1 className="text-title">{title}</h1>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <OwnerOnly />
      </Suspense>
    </AppShell>
  );
}

async function OwnerOnly() {
  await requireOwner();
  return (
    <EmptyState
      title={t.pronto.titulo}
      action={
        <ButtonLink href={routes.panel} variant="secondary" size="md">
          {t.pronto.volver}
        </ButtonLink>
      }
    >
      {t.pronto.cuerpo}
    </EmptyState>
  );
}
