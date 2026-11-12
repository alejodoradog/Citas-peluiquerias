import type { Metadata } from "next";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../../coming-soon";

const title = textos.ui.nuevaCita;

export const metadata: Metadata = { title };

// D-38, a manual appointment: task 4.2. Until then the free spaces and the
// "+" of the agenda (task 4.1) lead here, with ?barbero, ?dia and ?hora.
export default function Page() {
  return <ComingSoon title={title} />;
}
