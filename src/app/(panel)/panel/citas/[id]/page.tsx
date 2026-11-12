import type { Metadata } from "next";
import { Suspense } from "react";
import { textos } from "@/ui/textos";
import { ComingSoon } from "../../coming-soon";

const title = textos.agenda.detalle;

export const metadata: Metadata = { title };

// D-34, an appointment of the agenda: task 4.2. Until then the cards of the
// agenda (task 4.1) lead here.
// The bottom bar of ComingSoon reads the path (usePathname), which for this
// route is URL data: it waits inside a Suspense boundary, so prerendering
// stops here.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComingSoon title={title} />
    </Suspense>
  );
}
