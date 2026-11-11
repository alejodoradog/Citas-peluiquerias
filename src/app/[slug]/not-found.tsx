import { routes } from "@/lib/routes";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.reservas.noExiste;

// C-18: a booking link that is no barbershop's (a typo, a link changed more
// than 90 days ago, a deleted barbershop).
export default function BarbershopNotFound() {
  return (
    <AuthShell>
      <AuthHeading title={t.titulo} intro={t.bajada} />
      <TextLink href={routes.home} standalone>
        {t.conoceYapoin}
      </TextLink>
    </AuthShell>
  );
}
