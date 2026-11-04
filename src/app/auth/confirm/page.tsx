import type { Metadata } from "next";
import { Suspense } from "react";
import { confirmRecovery } from "@/modulos/cuentas/acciones/auth";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert, SubmitButton } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.confirmar;

export const metadata: Metadata = { title: t.titulo };

// The recovery email lands here. The one-time token is spent only after a
// tap, because some email scanners open links on their own.
export default function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  return (
    <AuthShell title={t.titulo} intro={t.bajada}>
      <Suspense fallback={null}>
        <ConfirmForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ConfirmForm({
  searchParams,
}: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  if (typeof tokenHash !== "string" || type !== "recovery") {
    return (
      <div className="flex flex-col gap-6">
        <FormAlert>{textos.cuentas.errores.link_expired}</FormAlert>
        <p className="text-base">
          <TextLink href="/recuperar-clave">
            {textos.cuentas.nuevaClave.pedirOtro}
          </TextLink>
        </p>
      </div>
    );
  }

  return (
    <form action={confirmRecovery}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input
        type="hidden"
        name="next"
        value={typeof next === "string" ? next : ""}
      />
      <SubmitButton pendingText={t.continuando}>{t.continuar}</SubmitButton>
    </form>
  );
}
