import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentAccess } from "@/lib/auth/access";
import { signOut } from "@/modulos/cuentas/acciones/auth";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert } from "@/ui/form";
import { textos } from "@/ui/textos";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { SignInForm } from "./sign-in-form";

const t = textos.cuentas.ingreso;

export const metadata: Metadata = { title: t.titulo };

export default function IngresarPage() {
  return (
    <AuthShell title={t.titulo}>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
        <NoAccessNotice />
      </Suspense>
      <SignInForm />
      <div className="mt-8 flex flex-col gap-3 text-base">
        <p>
          <TextLink href="/recuperar-clave">{t.olvidaste}</TextLink>
        </p>
        <p className="text-muted">
          {t.sinCuenta} <TextLink href="/registro">{t.crear}</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}

// An account without access (no profile, or deactivated) lands here with its
// session. It can see nothing; the notice explains why and offers to leave.
async function NoAccessNotice() {
  const access = await getCurrentAccess();
  if (access.kind !== "no_access") return null;
  return (
    <div className="mb-8 flex flex-col gap-3">
      <FormAlert>{t.sinAcceso}</FormAlert>
      <form action={signOut}>
        <button
          type="submit"
          className="text-brand-strong focus-visible:outline-brand rounded font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {textos.cuentas.salir}
        </button>
      </form>
    </div>
  );
}
