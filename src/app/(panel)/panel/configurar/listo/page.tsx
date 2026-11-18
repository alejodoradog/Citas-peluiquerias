import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  formatBogotaDayMonth,
  now,
  startOfBogotaDay,
  toBogotaDate,
} from "@/lib/fechas/fechas";
import { hasTrial } from "@/modulos/suscripciones/dominio/plans";
import { trialHasEnded } from "@/modulos/suscripciones/dominio/trial";
import { routes } from "@/lib/routes";
import { publicImageUrl } from "@/lib/imagenes/keys";
import {
  displayBookingUrl,
  posterFileName,
  publicBookingUrl,
} from "@/lib/sitio";
import { countActiveBarbers } from "@/modulos/barberias/datos/setup";
import { getShopProfile } from "@/modulos/barberias/datos/shop-profile";
import { requireOwner } from "@/modulos/cuentas/guards";
import { BookingLinkCard } from "@/ui/booking-link-card";
import { buttonClasses } from "@/ui/button";
import { CheckIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import {
  PosterDownloadButton,
  PosterPreview,
} from "@/ui/poster-download-button";
import { qrMatrix } from "@/ui/qr-code";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { ClearSetupDraft } from "./clear-setup-draft";
import { SetupInvitations } from "./invitations";

const t = textos.asistente.listo;

export const metadata: Metadata = { title: t.titulo };

// D-14: the end of the setup wizard, with the booking link ready to share.
export default function SetupDonePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-8.5 pb-6">
      <Suspense fallback={<LoadingState />}>
        <SetupDone />
      </Suspense>
    </main>
  );
}

async function SetupDone() {
  const { barbershop } = await requireOwner();
  if (barbershop.needsSetup) {
    redirect(routes.setup);
  }
  const [activeBarbers, profile] = await Promise.all([
    countActiveBarbers(barbershop.id),
    getShopProfile(barbershop.id),
  ]);
  const hasBarbers = activeBarbers > 0;
  // Task 7.9: the poster, seen and downloaded from the same drawing.
  const poster = {
    matrix: qrMatrix(publicBookingUrl(barbershop.slug)),
    caption: textos.compartir.qrTitulo,
    name: barbershop.name,
    link: displayBookingUrl(barbershop.slug),
    logoUrl: profile.logoPath ? publicImageUrl(profile.logoPath) : null,
  };
  const trialEnd = formatBogotaDayMonth(startOfBogotaDay(barbershop.expiresOn));
  // Only plan 1 has a free trial (task 7.8): plan 2's ended the day before
  // it signed up, and it learns how its first payment opens the bookings.
  const inTrial =
    hasTrial(barbershop.selectedPlan) &&
    barbershop.subscriptionStatus === "trial" &&
    !trialHasEnded(barbershop.expiresOn, toBogotaDate(now()));

  return (
    <>
      <ClearSetupDraft barbershopId={barbershop.id} />
      <span className="bg-success-soft text-success flex size-16 items-center justify-center rounded-full">
        <CheckIcon size={34} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">
          {hasBarbers ? t.titulo : t.tituloSinBarberos}
        </h1>
        <p className="text-body text-muted">
          {inTrial ? t.prueba(trialEnd) : textos.planes.listo.primerPago}
        </p>
      </div>
      {hasBarbers ? null : <Notice tone="warning" title={t.sinBarberos} />}
      {/* Task 8.17: how the invitations to the team went, from the database. */}
      <Suspense fallback={null}>
        <SetupInvitations barbershopId={barbershop.id} />
      </Suspense>
      <BookingLinkCard
        slug={barbershop.slug}
        name={barbershop.name}
        label={t.link}
      />
      <PosterPreview
        {...poster}
        alt={textos.compartir.aficheAlt(barbershop.name)}
      />
      <PosterDownloadButton
        {...poster}
        fileName={posterFileName(barbershop.slug)}
        label={t.descargarAfiche}
      />
      {/* A full page load, not a client navigation: the panel's first visit
          sent the owner here, and Next.js keeps that hidden page with its
          pending redirect to the wizard. Coming back to it with a Link
          would bounce the owner to the wizard and back. */}
      <a href={routes.panel} className={buttonClasses({})}>
        {t.agenda}
      </a>
    </>
  );
}
