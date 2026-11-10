import type { Metadata } from "next";
import { Suspense } from "react";
import { routes } from "@/lib/routes";
import { getCurrentAccess } from "@/modulos/cuentas/datos/access";
import { AuthHeading, AuthShell } from "@/ui/auth-shell";
import { Notice } from "@/ui/notice";
import { SignOutButton } from "@/ui/sign-out-button";
import { TextLink } from "@/ui/text-link";
import { textos } from "@/ui/textos";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { SignInForm } from "./sign-in-form";

const t = textos.cuentas.ingreso;

export const metadata: Metadata = { title: t.titulo };

// D-05, with the notices of D-06.
export default function IngresarPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <AuthShell>
      <AuthHeading title={t.titulo} />
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
        <NoAccessNotice />
        <EmailLinkNotice searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <TextLink href={routes.recoverPassword} standalone>
        {t.olvidaste}
      </TextLink>
      <p className="text-label text-muted text-center leading-[1.45] font-normal">
        {t.sinCuenta} <TextLink href={routes.signUp}>{t.crear}</TextLink>
      </p>
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
      <Notice tone="success" title={t.correoConfirmado.titulo}>
        {t.correoConfirmado.cuerpo}
      </Notice>
    );
  }
  if (vencido !== "1") return null;
  return <Notice tone="warning" title={t.linkVencido} />;
}

// An account without access (no profile, or deactivated) lands here with its
// session. It can see nothing; the notice explains why and offers to leave.
async function NoAccessNotice() {
  const access = await getCurrentAccess();
  if (access.kind !== "no_access") return null;
  return (
    <Notice
      tone="danger"
      title={t.sinAcceso}
      action={<SignOutButton variant="text" />}
    />
  );
}
