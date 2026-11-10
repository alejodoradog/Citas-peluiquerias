import type { Metadata } from "next";
import { routes } from "@/lib/routes";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../coming-soon";

const t = textos.mas;

export const metadata: Metadata = { title: t.barberos };

// D-53 arrives with delivery 2.2b; until then the row of Más lands here.
export default function Page() {
  return (
    <ComingSoon
      title={t.barberos}
      back={{ href: routes.panelMore, label: t.volver }}
    />
  );
}
