import type { Metadata } from "next";
import { LegalPage } from "@/ui/legal-page";
import { textos } from "@/ui/textos";

export const metadata: Metadata = { title: textos.legal.privacidad.titulo };

export default function Page() {
  return <LegalPage document="privacidad" />;
}
