import type { Metadata } from "next";
import { routes } from "@/lib/routes";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.proximamente;

export const metadata: Metadata = {
  title: t.barbero.titulo,
  robots: { index: false, follow: false },
};

// A barber's private link (D-56) before the barber's view exists (task 4.4).
// The token is not looked up: this page reads nothing and says the same for
// any token, so it tells nobody whether a link is valid. next.config.ts
// keeps it out of caches and referrers.
export default function BarberAgendaSoonPage() {
  return (
    <AuthShell>
      <AuthHeading title={t.barbero.titulo} intro={t.barbero.bajada} />
      <TextLink href={routes.home} standalone>
        {t.conoceYapoin}
      </TextLink>
    </AuthShell>
  );
}
