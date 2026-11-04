import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, TextLink } from "@/ui/auth-shell";
import { textos } from "@/ui/textos";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { RegistrationForm } from "./registration-form";

const t = textos.cuentas.registro;

export const metadata: Metadata = { title: t.titulo };

export default function RegistroPage() {
  return (
    <AuthShell title={t.titulo} intro={t.bajada}>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <RegistrationForm />
      <p className="text-muted mt-8 text-base">
        {t.yaTienes} <TextLink href="/ingresar">{t.ingresa}</TextLink>
      </p>
    </AuthShell>
  );
}
