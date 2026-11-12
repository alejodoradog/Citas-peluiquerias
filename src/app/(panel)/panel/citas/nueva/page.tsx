import type { Metadata } from "next";
import { Suspense } from "react";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../../coming-soon";

const title = textos.ui.nuevaCita;

export const metadata: Metadata = { title };

// D-38, a manual appointment: task 4.2. Until then the free spaces and the
// "+" of the agenda (task 4.1) lead here, with ?barbero, ?dia and ?hora.
// As in /panel/citas/[id], the bottom bar of ComingSoon (usePathname) waits
// inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComingSoon title={title} />
    </Suspense>
  );
}
