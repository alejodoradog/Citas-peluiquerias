import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert } from "@/ui/form";
import { textos } from "@/ui/textos";
import { routes } from "@/lib/routes";
import { RecoveryForm } from "./recovery-form";

const t = textos.cuentas.recuperar;

export const metadata: Metadata = { title: t.titulo };

export default function RecuperarClavePage({
  searchParams,
}: PageProps<"/recuperar-clave">) {
  return (
    <AuthShell title={t.titulo} intro={t.bajada}>
      <Suspense fallback={null}>
        <ExpiredLinkNotice searchParams={searchParams} />
      </Suspense>
      <RecoveryForm />
      <p className="mt-8 text-base">
        <TextLink href={routes.signIn}>{t.volver}</TextLink>
      </p>
    </AuthShell>
  );
}

async function ExpiredLinkNotice({
  searchParams,
}: Pick<PageProps<"/recuperar-clave">, "searchParams">) {
  const { vencido } = await searchParams;
  if (vencido !== "1") return null;
  return (
    <div className="mb-6">
      <FormAlert>{t.linkVencido}</FormAlert>
    </div>
  );
}
