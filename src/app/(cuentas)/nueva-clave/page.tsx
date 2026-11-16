import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import {
  getCurrentAccess,
  hasRecentRecoverySession,
} from "@/modulos/cuentas/datos/access";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { Notice } from "@/ui/notice";
import { SignOutButton } from "@/ui/sign-out-button";
import { LoadingState } from "@/ui/states";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";
import { NewPasswordForm } from "./new-password-form";

const t = textos.cuentas.nuevaClave;
const w = textos.cuentas.invitacion;

export const metadata: Metadata = { title: t.titulo };

// D-09, and the welcome of a professional who opened their invitation
// (task 7.6b): the same screen, which then also asks to accept the terms of
// use and the data policy.
export default function NuevaClavePage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <NewPasswordOrExpired />
      </Suspense>
    </AuthShell>
  );
}

// The recovery link (or the invitation) opens a session. Without one from
// the last hour, the link expired or was already used, or someone is just
// signed in.
async function NewPasswordOrExpired() {
  const [access, recent] = await Promise.all([
    getCurrentAccess(),
    hasRecentRecoverySession(),
  ]);
  const welcome = access.kind === "professional" && !access.acceptedTerms;
  if (!recent) {
    return welcome ? (
      <>
        <AuthHeading title={w.titulo} />
        {/* Opening the invitation confirmed the email (checked against the
            local Auth): the owner can no longer resend it, and a recovery
            link brings the professional back here, terms included. */}
        <Notice tone="warning" title={w.sinSesion.titulo}>
          {w.sinSesion.cuerpo}
        </Notice>
        <TextLink href={routes.recoverPassword} standalone>
          {w.sinSesion.pedir}
        </TextLink>
        <SignOutButton />
      </>
    ) : (
      <>
        <AuthHeading title={t.titulo} />
        <Notice tone="warning" title={t.sinSesion} />
        <TextLink href={routes.recoverPassword} standalone>
          {t.pedirOtro}
        </TextLink>
      </>
    );
  }
  if (welcome) {
    return (
      <>
        <AuthHeading
          title={w.titulo}
          intro={w.bajada(access.name, access.barbershop.name)}
        />
        <NewPasswordForm welcome />
      </>
    );
  }
  return (
    <>
      <AuthHeading title={t.titulo} />
      <NewPasswordForm />
    </>
  );
}
