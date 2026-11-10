import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/ui/auth-shell";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";
import { RecoveryForm } from "./recovery-form";

const t = textos.cuentas.recuperar;

export const metadata: Metadata = { title: t.titulo };

// D-07, and D-08 once the link is on its way.
export default function RecuperarClavePage({
  searchParams,
}: PageProps<"/recuperar-clave">) {
  return (
    <AuthShell>
      <RecoveryForm
        notice={
          <Suspense fallback={null}>
            <ExpiredLinkNotice searchParams={searchParams} />
          </Suspense>
        }
      />
    </AuthShell>
  );
}

async function ExpiredLinkNotice({
  searchParams,
}: Pick<PageProps<"/recuperar-clave">, "searchParams">) {
  const { vencido } = await searchParams;
  if (vencido !== "1") return null;
  return <Notice tone="warning" title={t.linkVencido} />;
}
