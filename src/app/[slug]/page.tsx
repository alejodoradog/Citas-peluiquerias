import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { findBarbershopNameBySlug } from "@/modulos/barberias/datos/public-barbershop";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { LoadingState } from "@/ui/states";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.proximamente;

// Out of search engines until the real booking page exists.
export const metadata: Metadata = {
  title: t.reservas.tituloPestana,
  robots: { index: false, follow: false },
};

// The booking link (yapoin.com/<slug>) that the QR and the poster of D-62
// already carry. Until the booking page (task 3.2) it says it is on its way,
// with the barbershop's name, instead of "not found".
export default function BookingSoonPage({ params }: PageProps<"/[slug]">) {
  return (
    <AuthShell>
      <Suspense fallback={<LoadingState label={t.reservas.cargando} />}>
        <BookingSoon params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function BookingSoon({ params }: Pick<PageProps<"/[slug]">, "params">) {
  const { slug } = await params;
  const name = await findBarbershopNameBySlug(slug);
  if (!name) notFound();
  return (
    <>
      <AuthHeading title={t.reservas.titulo(name)} intro={t.reservas.bajada} />
      <TextLink href={routes.home} standalone>
        {t.conoceYapoin}
      </TextLink>
    </>
  );
}
