import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { getCurrentAccess } from "@/modulos/cuentas/datos/access";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert } from "@/ui/form";
import { SignOutButton } from "@/ui/sign-out-button";
import { textos } from "@/ui/textos";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { SignInForm } from "./sign-in-form";

const t = textos.cuentas.ingreso;

export const metadata: Metadata = { title: t.titulo };

export default function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <AuthShell title={t.titulo}>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
        <NoAccessNotice />
        <EmailLinkNotice searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <div className="mt-8 flex flex-col gap-3 text-base">
        <p>
          <TextLink href={routes.recoverPassword}>{t.olvidaste}</TextLink>
        </p>
        <p className="text-muted">
          {t.sinCuenta} <TextLink href={routes.signUp}>{t.crear}</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}

// Where the email confirmation link leaves the owner.
async function EmailLinkNotice({
  searchParams,
}: Pick<PageProps<"/ingresar">, "searchParams">) {
  const { vencido, confirmado } = await searchParams;
  if (confirmado === "1") {
    return (
      <div className="mb-6">
        <FormAlert tone="info">{t.correoConfirmado}</FormAlert>
      </div>
    );
  }
  if (vencido !== "1") return null;
  return (
    <div className="mb-6">
      <FormAlert>{t.linkVencido}</FormAlert>
    </div>
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
      <div>
        <SignOutButton variant="link" />
      </div>
    </div>
  );
}
