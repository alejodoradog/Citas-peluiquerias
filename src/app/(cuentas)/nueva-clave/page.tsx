import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { hasRecentRecoverySession } from "@/modulos/cuentas/datos/access";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { Notice } from "@/ui/notice";
import { LoadingState } from "@/ui/states";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";
import { NewPasswordForm } from "./new-password-form";

const t = textos.cuentas.nuevaClave;

export const metadata: Metadata = { title: t.titulo };

// D-09.
export default function NuevaClavePage() {
  return (
    <AuthShell>
      <AuthHeading title={t.titulo} />
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <NewPasswordOrExpired />
      </Suspense>
    </AuthShell>
  );
}

// The recovery link opens a session. Without one from the last hour, the
// link expired or was already used, or someone is just signed in.
async function NewPasswordOrExpired() {
  if (!(await hasRecentRecoverySession())) {
    return (
      <>
        <Notice tone="warning" title={t.sinSesion} />
        <TextLink href={routes.recoverPassword} standalone>
          {t.pedirOtro}
        </TextLink>
      </>
    );
  }
  return <NewPasswordForm />;
}
