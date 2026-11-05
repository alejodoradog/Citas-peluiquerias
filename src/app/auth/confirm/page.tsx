import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import {
  confirmEmailAddress,
  confirmPasswordRecovery,
} from "@/modulos/cuentas/acciones/account";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert, SubmitButton } from "@/ui/form";
import { textos } from "@/ui/textos";

const t = textos.cuentas.confirmar;

export const metadata: Metadata = { title: t.titulo };

// The recovery and email confirmation links land here. The one-time token is
// spent only after a tap, because some email scanners open links on their own.
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
  if (typeof tokenHash !== "string" && type === "signup") {
    return (
      <div className="flex flex-col gap-6">
        <FormAlert>{textos.cuentas.ingreso.linkVencido}</FormAlert>
        <p className="text-base">
          <TextLink href={routes.signIn}>
            {textos.cuentas.recuperar.volver}
          </TextLink>
        </p>
      </div>
    );
  }
  if (
    typeof tokenHash !== "string" ||
    (type !== "recovery" && type !== "signup")
  ) {
    return (
      <div className="flex flex-col gap-6">
        <FormAlert>{textos.cuentas.errores.link_expired}</FormAlert>
        <p className="text-base">
          <TextLink href={routes.recoverPassword}>
            {textos.cuentas.nuevaClave.pedirOtro}
          </TextLink>
        </p>
      </div>
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
