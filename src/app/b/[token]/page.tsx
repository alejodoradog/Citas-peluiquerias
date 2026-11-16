import type { Metadata } from "next";
import { connection } from "next/server";
import { LoadingState } from "@/ui/states";
import { ScreenSuspense } from "@/ui/tap-feedback";
import { textos } from "@/ui/textos";
import { AgendaScreen } from "../../_agenda-profesional/agenda-screen";
import { BarberLinkGone } from "../../_agenda-profesional/link-gone";

const t = textos.barbero;

// The link is a credential: no search engine keeps it, and no page it opens
// learns it from the Referer (next.config.ts also sends no-store).
export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-01 and B-02 (task 4.4): "Mi agenda" of a barber, from their private
// link; B-05 when the link no longer works and B-06 when the barbershop is
// paused. The token is the whole credential; only its hash reaches the
// database. The screen is the one of /mi-agenda (task 7.6b); this entry
// leaves with task 7.6c.
export default function BarberAgendaPage({
  params,
  searchParams,
}: PageProps<"/b/[token]">) {
  return (
    <ScreenSuspense fallback={<LoadingState label={t.cargando} />}>
      <BarberAgenda params={params} searchParams={searchParams} />
    </ScreenSuspense>
  );
}

async function BarberAgenda({
  params,
  searchParams,
}: Pick<PageProps<"/b/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  // Always live: a booking can arrive at any moment.
  await connection();
  return (
    <AgendaScreen
      entry={{ kind: "link", token }}
      search={await searchParams}
      gone={<BarberLinkGone />}
      footnote={t.soloTuyo}
    />
  );
}
