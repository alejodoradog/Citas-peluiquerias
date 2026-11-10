import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { AppShell } from "@/ui/app-shell";
import { ButtonLink } from "@/ui/button";
import { EmptyState, LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "./ready-owner";

const t = textos.panel;

// A section whose screens arrive in a later task: Clientes (4.3), Compartir
// (2.5) and Barberos (2.2b). Only owners who finished the wizard reach it.
// It goes back to the agenda unless it says where else.
export function ComingSoon({
  title,
  back = { href: routes.panel, label: t.pronto.volver },
}: {
  title: string;
  back?: { href: string; label: string };
}) {
  return (
    <AppShell bottomNav>
      <h1 className="text-title">{title}</h1>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <OwnerOnly back={back} />
      </Suspense>
    </AppShell>
  );
}

async function OwnerOnly({ back }: { back: { href: string; label: string } }) {
  await requireReadyOwner();
  return (
    <EmptyState
      title={t.pronto.titulo}
      action={
        <ButtonLink href={back.href} variant="secondary" size="md">
          {back.label}
        </ButtonLink>
      }
    >
      {t.pronto.cuerpo}
    </EmptyState>
  );
}
