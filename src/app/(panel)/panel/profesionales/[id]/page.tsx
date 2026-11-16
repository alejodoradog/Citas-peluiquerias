import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  formatBogotaDayMonth,
  formatBogotaTime,
  now,
} from "@/lib/fechas/fechas";
import { publicImageUrl } from "@/lib/imagenes/keys";
import {
  removeBarberPhoto,
  setBarberActive,
  updateBarber,
} from "@/modulos/barberias/acciones/barbers";
import {
  discardImageUpload,
  requestImageUpload,
} from "@/modulos/barberias/acciones/images";
import {
  getBarber,
  listActiveServiceOptions,
} from "@/modulos/barberias/datos/barbers";
import { barberLinkState } from "@/modulos/barberias/dominio/barber-link";
import {
  inviteProfessional,
  revokeProfessionalAccess,
} from "@/modulos/cuentas/acciones/professional-access";
import { readAccountStatus } from "@/modulos/cuentas/datos/professional-access";
import { accessView } from "@/modulos/cuentas/dominio/professional-access";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../../ready-owner";
import type { AccessCard } from "../access-section";
import { BarberEditor } from "../barber-editor";
import { summarizeBarberHours } from "../barber-summary";
import { EditorLoading } from "../editor-loading";

const t = textos.barberos;

export const metadata: Metadata = { title: t.editar };

// D-54 for an existing barber. The id comes from the URL: one that is not an
// id, or a barber of another barbershop, is "not found".
export default function EditBarberPage({
  params,
}: PageProps<"/panel/profesionales/[id]">) {
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
  const [barber, services, account] = await Promise.all([
    getBarber(barbershop.id, id),
    listActiveServiceOptions(barbershop.id),
    // Task 7.6b. The database answers only for the owner's own professional.
    readAccountStatus(id),
  ]);
  if (!barber) notFound();
  const view = account
    ? accessView({
        status: account,
        hasEmail: (barber.email ?? "").trim() !== "",
        active: barber.active,
        now: now(),
      })
    : null;
  const card: AccessCard | null =
    view?.kind === "invited"
      ? {
          kind: "invited",
          until: t.acceso.fechaHora(
            formatBogotaDayMonth(view.until),
            formatBogotaTime(view.until),
          ),
        }
      : view;

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
        linkState: barberLinkState({
          isOwner: barber.is_owner,
          linkActive: barber.link_active,
          linkIssuedAt: barber.link_issued_at,
        }),
        linkSentOn: barber.link_issued_at
          ? formatBogotaDayMonth(new Date(barber.link_issued_at))
          : null,
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
      discardUpload={discardImageUpload}
      setActive={setBarberActive}
      removePhoto={removeBarberPhoto}
      access={
        card && !barber.is_owner
          ? {
              card,
              invite: inviteProfessional,
              revoke: revokeProfessionalAccess,
            }
          : undefined
      }
    />
  );
}
