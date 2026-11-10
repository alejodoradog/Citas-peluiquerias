import { routes } from "@/lib/routes";
import { AppShell } from "@/ui/app-shell";
import { ButtonLink } from "@/ui/button";
import { EmptyState } from "@/ui/states";
import { textos } from "@/ui/textos";

const t = textos.noEncontrado;

// A panel link that leads nowhere: a service id that does not exist or
// belongs to another barbershop (D-52), or a mistyped address.
export default function PanelNotFound() {
  return (
    <AppShell>
      <h1 className="text-title">{t.titulo}</h1>
      <EmptyState
        title={t.bajada}
        action={
          <ButtonLink href={routes.panel} variant="secondary" size="md">
            {t.volver}
          </ButtonLink>
        }
      />
    </AppShell>
  );
}
