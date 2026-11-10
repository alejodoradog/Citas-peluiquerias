import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import {
  confirmEmailAddress,
  confirmPasswordRecovery,
} from "@/modulos/cuentas/acciones/account";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { SubmitButton } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.confirmar;

export const metadata: Metadata = { title: t.titulo };

// D-04. The recovery and email confirmation links land here. The one-time
// token is spent only after a tap, because some email scanners open links on
// their own.
export default function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  return (
    <AuthShell>
      <AuthHeading title={t.titulo} intro={t.bajada} />
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
  if (typeof tokenHash !== "string" && type === "signup") {
    return (
      <>
        <Notice tone="warning" title={textos.cuentas.ingreso.linkVencido} />
        <TextLink href={routes.signIn} standalone>
          {textos.cuentas.recuperar.volver}
        </TextLink>
      </>
    );
  }
  if (
    typeof tokenHash !== "string" ||
    (type !== "recovery" && type !== "signup")
  ) {
    return (
      <>
        <Notice tone="warning" title={textos.cuentas.errores.link_expired} />
        <TextLink href={routes.recoverPassword} standalone>
          {textos.cuentas.nuevaClave.pedirOtro}
        </TextLink>
      </>
    );
  }

  return (
    <form
      action={type === "signup" ? confirmEmailAddress : confirmPasswordRecovery}
    >
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input
        type="hidden"
        name="next"
        value={typeof next === "string" ? next : ""}
      />
      <SubmitButton pendingText={t.continuando}>{t.continuar}</SubmitButton>
    </form>
  );
}
