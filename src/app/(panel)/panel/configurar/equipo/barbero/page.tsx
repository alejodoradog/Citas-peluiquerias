import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_BARBERSHOP_HOURS } from "@/modulos/barberias/dominio/hours";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { SetupStepGate } from "../../guard";
import { summarizeHours } from "../../hours-summary";
import { BarberForm } from "./barber-form";

export const metadata: Metadata = { title: textos.asistente.barbero.agregar };

// D-13: add or edit a barber of the wizard draft.
export default function BarberPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupStepGate>
        {() => (
          <BarberForm hoursSummary={summarizeHours(DEFAULT_BARBERSHOP_HOURS)} />
        )}
      </SetupStepGate>
    </Suspense>
  );
}
