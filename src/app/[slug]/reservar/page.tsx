import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import {
  chosenServices,
  loadPublicAvailability,
} from "@/modulos/agenda/datos/public-availability";
import { loadPublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  FIRST_AVAILABLE,
  readBookingParams,
} from "@/modulos/agenda/dominio/booking-flow";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { BarberStep } from "./barber-step";
import { DetailsStep } from "./details-step";
import { ServicesStep } from "./services-step";
import { TimeStep } from "./time-step";

const t = textos.reservas;

// Search engines keep the profile (C-01), not every step of the flow.
export const metadata: Metadata = {
  title: textos.marca,
  robots: { index: false, follow: true },
};

// C-02 to C-07 (tasks 3.2 and 3.3). The choices live in the URL
// (booking-flow.ts), so "atrás" and sharing work. The profile comes from the
// short cache; the free times are always computed live.
export default function BookingFlowPage({
  params,
  searchParams,
}: PageProps<"/[slug]/reservar">) {
  return (
    <Suspense fallback={<LoadingState label={t.cargando} />}>
      <BookingFlow params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function BookingFlow({
  params,
  searchParams,
}: Pick<PageProps<"/[slug]/reservar">, "params" | "searchParams">) {
  const { slug } = await params;
  const profile = await loadPublicProfile(slug);
  if (!profile) notFound();
  if (!profile.acceptsBookings) redirect(routes.booking(profile.slug));

  const selection = readBookingParams(await searchParams);
  const flow = routes.bookingFlow(profile.slug);
  if (selection.step === "servicios") {
    return <ServicesStep profile={profile} selection={selection} />;
  }
  // Services the barbershop no longer offers: choose them again.
  if (!chosenServices(profile, selection.serviceIds)) redirect(flow);

  // Availability is always live (task 3.2): the moment is the request's.
  await connection();
  const instant = now();
  if (selection.step === "barbero") {
    const availability = (await loadPublicAvailability(
      profile,
      selection.serviceIds,
      null,
      instant,
    ))!;
    return (
      <BarberStep
        profile={profile}
        selection={selection}
        availability={availability}
        today={toBogotaDate(instant)}
      />
    );
  }

  const availability = (await loadPublicAvailability(
    profile,
    selection.serviceIds,
    selection.barber,
    instant,
  ))!;
  // A barber who left or no longer does these services: choose again.
  if (
    selection.barber !== FIRST_AVAILABLE &&
    availability.barbers.length === 0
  ) {
    redirect(
      flow +
        bookingQuery({ serviceIds: selection.serviceIds, step: "barbero" }),
    );
  }

  if (selection.step === "hora") {
    return (
      <TimeStep
        profile={profile}
        selection={selection}
        availability={availability}
        today={toBogotaDate(instant)}
      />
    );
  }
  return (
    <DetailsStep
      profile={profile}
      selection={selection}
      availability={availability}
    />
  );
}
