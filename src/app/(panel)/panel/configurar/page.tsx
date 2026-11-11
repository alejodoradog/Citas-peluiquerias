import type { Metadata } from "next";
import { Suspense } from "react";
import { switchBarbershop } from "@/modulos/cuentas/acciones/active-barbershop";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { WizardBarbershopSwitch } from "../sedes/barbershop-switcher";
import { switcherBarbershops } from "../sedes/switcher-barbershops";
import { SetupStepGate } from "./guard";
import { ServicesStep } from "./services-step";

const t = textos.asistente.servicios;

export const metadata: Metadata = { title: t.barra };

// D-10 and D-11: step 2 of 3 of the setup wizard. An owner with several
// sedes can leave for another one from its top bar (task 2.6).
export default function ServicesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupStepGate>
        {({ barbershop, barbershops }) => (
          <ServicesStep
            topAction={
              <WizardBarbershopSwitch
                barbershops={switcherBarbershops(barbershops)}
                activeId={barbershop.id}
                switchTo={switchBarbershop}
              />
            }
          />
        )}
      </SetupStepGate>
    </Suspense>
  );
}
