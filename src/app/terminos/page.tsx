import type { Metadata } from "next";
import { LegalPage } from "@/ui/legal-page";
import { textos } from "@/ui/textos";

const title = textos.legal.terminos.titulo;

export const metadata: Metadata = { title };

export default function Page() {
  return <LegalPage title={title} />;
}
