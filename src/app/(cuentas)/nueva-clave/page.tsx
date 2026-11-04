import type { Metadata } from "next";
import { Suspense } from "react";
import { hasRecentRecoverySession } from "@/modulos/cuentas/datos/access";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert } from "@/ui/form";
import { textos } from "@/ui/textos";
import { routes } from "@/lib/routes";
import { NewPasswordForm } from "./new-password-form";

const t = textos.cuentas.nuevaClave;

export const metadata: Metadata = { title: t.titulo };

export default function NuevaClavePage() {
  return (
    <AuthShell title={t.titulo}>
      <Suspense fallback={<p className="text-muted">{t.cargando}</p>}>
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
      <div className="flex flex-col gap-6">
        <FormAlert>{t.sinSesion}</FormAlert>
        <p className="text-base">
          <TextLink href={routes.recoverPassword}>{t.pedirOtro}</TextLink>
        </p>
      </div>
    );
  }
  return <NewPasswordForm />;
}
