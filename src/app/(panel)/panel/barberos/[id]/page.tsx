import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBogotaDayMonth } from "@/lib/fechas/fechas";
import { publicImageUrl } from "@/lib/imagenes/keys";
import {
  removeBarberPhoto,
  requestImageUpload,
  setBarberActive,
  updateBarber,
} from "@/modulos/barberias/acciones/barbers";
import {
  getBarber,
  listActiveServiceOptions,
} from "@/modulos/barberias/datos/barbers";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../../ready-owner";
import { BarberEditor } from "../barber-editor";
import { summarizeBarberHours } from "../barber-summary";
import { EditorLoading } from "../editor-loading";

const t = textos.barberos;

export const metadata: Metadata = { title: t.editar };

// D-54 for an existing barber. The id comes from the URL: one that is not an
// id, or a barber of another barbershop, is "not found".
export default function EditBarberPage({
  params,
}: PageProps<"/panel/barberos/[id]">) {
  return (
    <Suspense fallback={<EditorLoading title={t.editar} />}>
      <EditBarber params={params} />
    </Suspense>
  );
}

async function EditBarber({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { barbershop }] = await Promise.all([
    params,
    requireReadyOwner(),
  ]);
  const [barber, services] = await Promise.all([
    getBarber(barbershop.id, id),
    listActiveServiceOptions(barbershop.id),
  ]);
  if (!barber) notFound();

  return (
    <BarberEditor
      action={updateBarber}
      barber={{
        id: barber.id,
        displayName: barber.display_name,
        email: barber.email,
        emailNotifications: barber.email_notifications,
        photoUrl: barber.photo_path ? publicImageUrl(barber.photo_path) : null,
        serviceIds: barber.service_ids,
        active: barber.active,
        isOwner: barber.is_owner,
        linkActive: barber.link_active,
        inactiveSince: barber.deactivated_at
          ? formatBogotaDayMonth(new Date(barber.deactivated_at))
          : null,
      }}
      services={services}
      hoursSummary={summarizeBarberHours(
        barber.uses_barbershop_hours,
        barber.shifts,
      )}
      requestUpload={requestImageUpload}
      setActive={setBarberActive}
      removePhoto={removeBarberPhoto}
    />
  );
}
