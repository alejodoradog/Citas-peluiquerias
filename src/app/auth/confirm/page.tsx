import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import {
  confirmEmailAddress,
  confirmInvitation,
  confirmPasswordRecovery,
} from "@/modulos/cuentas/acciones/account";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { SubmitButton } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";

const t = textos.cuentas.confirmar;
const w = textos.cuentas.invitacion.abrir;

export const metadata: Metadata = { title: t.titulo };

// D-04. The recovery and email confirmation links land here, and the
// invitation of a professional (task 7.6b). The one-time
// token is spent only after a tap, because some email scanners open links on
// their own.
export default function ConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  return (
    <AuthShell>
      <Suspense fallback={<AuthHeading title={t.titulo} intro={t.bajada} />}>
        <ConfirmForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ConfirmForm({
  searchParams,
}: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const heading = <AuthHeading title={t.titulo} intro={t.bajada} />;
  if (typeof tokenHash !== "string" && type === "invite") {
    return (
      <>
        {heading}
        <Notice tone="warning" title={textos.cuentas.invitacion.vencida.titulo}>
          {textos.cuentas.invitacion.vencida.cuerpo}
        </Notice>
        <TextLink href={routes.signIn} standalone>
          {textos.cuentas.recuperar.volver}
        </TextLink>
      </>
    );
  }
  if (typeof tokenHash !== "string" && type === "signup") {
    return (
      <>
        {heading}
        <Notice tone="warning" title={textos.cuentas.ingreso.linkVencido} />
        <TextLink href={routes.signIn} standalone>
          {textos.cuentas.recuperar.volver}
        </TextLink>
      </>
    );
  }
  if (
    typeof tokenHash !== "string" ||
    (type !== "recovery" && type !== "signup" && type !== "invite")
  ) {
    return (
      <>
        {heading}
        <Notice tone="warning" title={textos.cuentas.errores.link_expired} />
        <TextLink href={routes.recoverPassword} standalone>
          {textos.cuentas.nuevaClave.pedirOtro}
        </TextLink>
      </>
    );
  }

  // Task 8.11: an invitation says what it is before the tap. It cannot say
  // who invites yet: nobody is signed in, and a name written in the link
  // could be anyone's. The next screen says it, read from the database.
  const invite = type === "invite";
  return (
    <>
      {invite ? <AuthHeading title={w.titulo} intro={w.bajada} /> : heading}
      <form
        action={
          type === "signup"
            ? confirmEmailAddress
            : invite
              ? confirmInvitation
              : confirmPasswordRecovery
        }
      >
        <input type="hidden" name="tokenHash" value={tokenHash} />
        <input
          type="hidden"
          name="next"
          value={typeof next === "string" ? next : ""}
        />
        <SubmitButton pendingText={t.continuando}>
          {invite ? w.continuar : t.continuar}
        </SubmitButton>
      </form>
    </>
  );
}
