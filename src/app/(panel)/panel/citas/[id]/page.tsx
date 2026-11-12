import type { Metadata } from "next";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../../coming-soon";

const title = textos.agenda.detalle;

export const metadata: Metadata = { title };

// D-34, an appointment of the agenda: task 4.2. Until then the cards of the
// agenda (task 4.1) lead here.
export default function Page() {
  return <ComingSoon title={title} />;
}
