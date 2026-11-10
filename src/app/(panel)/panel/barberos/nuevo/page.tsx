import type { Metadata } from "next";
import { Suspense } from "react";
import {
  createBarber,
  requestImageUpload,
} from "@/modulos/barberias/acciones/barbers";
import { listActiveServiceOptions } from "@/modulos/barberias/datos/barbers";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../../ready-owner";
import { BarberEditor } from "../barber-editor";
import { EditorLoading } from "../editor-loading";

const t = textos.barberos;

export const metadata: Metadata = { title: t.nuevo };

// D-54 for a new barber: the barbershop's hours, every active service
// (decision 4 of task 2.2) and a private link created when saved.
export default function NewBarberPage() {
  return (
    <Suspense fallback={<EditorLoading title={t.nuevo} />}>
      <NewBarber />
    </Suspense>
  );
}

async function NewBarber() {
  const { barbershop } = await requireReadyOwner();
  const services = await listActiveServiceOptions(barbershop.id);
  return (
    <BarberEditor
      action={createBarber}
      barber={null}
      services={services}
      hoursSummary={t.horarioBarberia}
      requestUpload={requestImageUpload}
    />
  );
}
