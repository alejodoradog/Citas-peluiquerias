import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { FormAlert } from "@/ui/form";
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
        <NoAccessNotice searchParams={searchParams} />
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

async function NoAccessNotice({
  searchParams,
}: Pick<PageProps<"/ingresar">, "searchParams">) {
  const { aviso } = await searchParams;
  if (aviso !== "sin-acceso") return null;
  return (
    <div className="mb-6">
      <FormAlert>{t.sinAcceso}</FormAlert>
    </div>
  );
}
