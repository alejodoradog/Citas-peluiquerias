import type { Metadata } from "next";
import { Suspense } from "react";
import { publicImageUrl } from "@/lib/imagenes/keys";
import { getShopProfile } from "@/modulos/barberias/datos/shop-profile";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { SetupStepGate } from "../guard";
import { LocationStep } from "./location-step";

export const metadata: Metadata = { title: textos.asistente.ubicacion.barra };

// Step 3 of 4 of the setup wizard (task 7.3): where the establishment is,
// from the owner's phone. Required: the customer always finds the map.
export default function LocationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SetupStepGate>
        {({ barbershop }) => <Location barbershopId={barbershop.id} />}
      </SetupStepGate>
    </Suspense>
  );
}

async function Location({ barbershopId }: { barbershopId: string }) {
  const saved = await getShopProfile(barbershopId);
  return (
    <LocationStep
      saved={saved.location}
      shopName={saved.name}
      logoUrl={saved.logoPath ? publicImageUrl(saved.logoPath) : null}
    />
  );
}
