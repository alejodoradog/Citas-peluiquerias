import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/ui/auth-shell";
import { textos } from "@/ui/textos";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { title: textos.cuentas.registro.titulo };

// D-02, and D-03 once the account is created.
export default function RegistroPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <RegistrationForm />
    </AuthShell>
  );
}
