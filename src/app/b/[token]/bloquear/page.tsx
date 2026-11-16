import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { BlockScreen } from "../../../_agenda-profesional/block-screen";
import { BarberLinkGone } from "../../../_agenda-profesional/link-gone";

const t = textos.barbero;

export const metadata: Metadata = {
  title: t.bloquear.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-04 (task 4.4) by the private link.
export default function BarberBlockPage({
  params,
}: PageProps<"/b/[token]/bloquear">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BarberBlock params={params} />
    </Suspense>
  );
}

async function BarberBlock({
  params,
}: Pick<PageProps<"/b/[token]/bloquear">, "params">) {
  const { token } = await params;
  await connection();
  return (
    <BlockScreen entry={{ kind: "link", token }} gone={<BarberLinkGone />} />
  );
}
