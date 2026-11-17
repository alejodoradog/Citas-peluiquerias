import type { Metadata } from "next";
import { professionalBookingUrl } from "@/lib/sitio";
import { requireProfessional } from "@/modulos/cuentas/guards";
import { ShareButton } from "@/ui/share-button";
import { LoadingState } from "@/ui/states";
import { ScreenSuspense } from "@/ui/tap-feedback";
import { textos } from "@/ui/textos";
import { AgendaScreen } from "../_agenda-profesional/agenda-screen";

const t = textos.barbero;
const m = textos.miAgenda;

export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-01 and B-02 by the professional's own session (task 7.6b, decision
// 0010): the screens of task 4.4, plus "Cerrar sesión" and the link of the
// booking page that brings the professional already chosen (point 6).
// Who the professional is comes from the session only (my_* functions).
export default function MyAgendaPage({
  searchParams,
}: PageProps<"/mi-agenda">) {
  return (
    <ScreenSuspense fallback={<LoadingState label={t.cargando} />}>
      <MyAgenda searchParams={searchParams} />
    </ScreenSuspense>
  );
}

async function MyAgenda({
  searchParams,
}: Pick<PageProps<"/mi-agenda">, "searchParams">) {
  // Reads the session, so it is always live, as the agenda must be.
  const access = await requireProfessional();
  const url = professionalBookingUrl(access.barbershop.slug, access.barberId);
  return (
    <AgendaScreen
      search={await searchParams}
      share={
        <ShareButton
          url={url}
          title={access.barbershop.name}
          text={m.compartir.mensaje(access.barbershop.name)}
          label={m.compartir.boton}
        />
      }
    />
  );
}
