import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateService } from "@/modulos/barberias/acciones/services";
import {
  getService,
  listActiveBarbers,
} from "@/modulos/barberias/datos/services";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../../ready-owner";
import { EditorLoading } from "../editor-loading";
import { ServiceEditor } from "../service-editor";

const title = textos.servicios.editar;

export const metadata: Metadata = { title };

// D-52 for an existing service. The id comes from the URL: one that is not an
// id, or a service of another barbershop, is "not found".
export default function EditServicePage({
  params,
}: PageProps<"/panel/servicios/[id]">) {
  return (
    <Suspense fallback={<EditorLoading title={title} />}>
      <EditService params={params} />
    </Suspense>
  );
}

async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const [service, barbers] = await Promise.all([
    getService(barbershop.id, id),
    listActiveBarbers(barbershop.id),
  ]);
  if (!service) notFound();

  return (
    <ServiceEditor
      action={updateService}
      service={{
        id: service.id,
        name: service.name,
        priceCop: service.price_cop,
        durationMinutes: service.duration_minutes,
        active: service.active,
        barberIds: service.barber_ids,
      }}
      barbers={barbers.map((b) => ({ id: b.id, displayName: b.display_name }))}
    />
  );
}
