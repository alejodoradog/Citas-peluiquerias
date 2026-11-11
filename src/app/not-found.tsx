import { routes } from "@/lib/routes";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.noEncontrado;

// Outside the panel: a booking link that is no barbershop's, or a mistyped
// address. The panel has its own (src/app/(panel)/panel/not-found.tsx).
export default function NotFound() {
  return (
    <AuthShell>
      <AuthHeading title={t.titulo} intro={t.bajada} />
      <TextLink href={routes.home} standalone>
        {t.inicio}
      </TextLink>
    </AuthShell>
  );
}
