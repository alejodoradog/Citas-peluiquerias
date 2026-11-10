import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { SetupStepGate } from "../guard";
import { TeamStep } from "./team-step";

export const metadata: Metadata = { title: textos.asistente.equipo.barra };

// D-12: step 3 of 3 of the setup wizard.
export default function TeamPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupStepGate>
        {(owner) => <TeamStep ownerName={owner.name} />}
      </SetupStepGate>
    </Suspense>
  );
}
