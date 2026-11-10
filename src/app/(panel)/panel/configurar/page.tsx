import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { SetupStepGate } from "./guard";
import { ServicesStep } from "./services-step";

const t = textos.asistente.servicios;

export const metadata: Metadata = { title: t.barra };

// D-10 and D-11: step 2 of 3 of the setup wizard.
export default function ServicesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupStepGate>{() => <ServicesStep />}</SetupStepGate>
    </Suspense>
  );
}
