import type { Metadata } from "next";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../coming-soon";

const title = textos.panel.secciones.compartir;

export const metadata: Metadata = { title };

export default function Page() {
  return <ComingSoon title={title} />;
}
