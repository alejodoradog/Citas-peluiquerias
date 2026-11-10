import type { Metadata } from "next";
import { Suspense } from "react";
import { createService } from "@/modulos/barberias/acciones/services";
import { listActiveBarbers } from "@/modulos/barberias/datos/services";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../../ready-owner";
import { EditorLoading } from "../editor-loading";
import { ServiceEditor } from "../service-editor";

const title = textos.servicios.nuevo;

export const metadata: Metadata = { title };

// D-52 for a new service.
export default function NewServicePage() {
  return (
    <Suspense fallback={<EditorLoading title={title} />}>
      <NewService />
    </Suspense>
  );
}

async function NewService() {
  const { barbershop } = await requireReadyOwner();
  const barbers = await listActiveBarbers(barbershop.id);
  return (
    <ServiceEditor
      action={createService}
      service={null}
      barbers={barbers.map((b) => ({ id: b.id, displayName: b.display_name }))}
    />
  );
}
