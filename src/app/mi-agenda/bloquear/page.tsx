import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfessional } from "@/modulos/cuentas/guards";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { BlockScreen } from "../../_agenda-profesional/block-screen";

const t = textos.barbero;

export const metadata: Metadata = {
  title: t.bloquear.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// B-04 by the session (task 7.6b).
export default function MyBlockPage() {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <MyBlock />
    </Suspense>
  );
}

async function MyBlock() {
  await requireProfessional();
  return <BlockScreen />;
}
