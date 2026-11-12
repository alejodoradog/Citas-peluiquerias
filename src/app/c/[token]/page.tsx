import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { now, toBogotaDate, toBogotaTime } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { loadManagedAppointment } from "@/modulos/agenda/datos/manage-appointment";
import { loadRescheduleAvailability } from "@/modulos/agenda/datos/public-availability";
import { loadPublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  manageQuery,
  readManageParams,
} from "@/modulos/agenda/dominio/manage-flow";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import {
  calendarUrl,
  directionsUrl,
  whatsappUrl,
} from "../../[slug]/booking-ui";
import { whenLine } from "../../[slug]/reservar/summary";
import { AppointmentView } from "./appointment-view";
import { LinkGone } from "./link-gone";
import { RescheduleStep } from "./reschedule-step";

const t = textos.reservas.gestionar;

// The link is a credential: no search engine keeps it, and no page it opens
// learns it from the Referer.
export const metadata: Metadata = {
  title: t.tituloPestana,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// C-09 to C-13 and C-16 (task 3.4): the customer's appointment, from the
// private link given on C-08 (and from phase 5, in the emails). The token
// is the whole credential; only its hash reaches the database.
export default function ManageAppointmentPage({
  params,
  searchParams,
}: PageProps<"/c/[token]">) {
  return (
    <Suspense fallback={<LoadingState label={textos.reservas.cargando} />}>
      <ManageAppointment params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ManageAppointment({
  params,
  searchParams,
}: Pick<PageProps<"/c/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  // Always live: the appointment changes with every cancellation or move,
  // and the policy's hours run with the clock.
  await connection();
  const appointment = await loadManagedAppointment(token);
  const profile = appointment
    ? await loadPublicProfile(appointment.slug)
    : null;
  if (!appointment || !profile) return <LinkGone token={token} />;

  const selection = readManageParams(await searchParams);
  const date = toBogotaDate(appointment.start);
  const time = toBogotaTime(appointment.start);
  const minutes = Math.round(
    (appointment.end.getTime() - appointment.start.getTime()) / 60_000,
  );
  const services = `${appointment.serviceNames.join(" + ")} · ${textos.reservas.minutos(minutes)}`;
  const canMove = appointment.changeable && profile.acceptsBookings;

  if (selection.step === "cambiar" && canMove) {
    const instant = now();
    return (
      <RescheduleStep
        token={token}
        days={await loadRescheduleAvailability(profile, appointment, instant)}
        today={toBogotaDate(instant)}
        selection={selection}
        current={{ date, time }}
        summary={`${services} · ${appointment.barberName}`}
        barberName={appointment.barberName}
        priceCop={appointment.priceCop}
      />
    );
  }

  const place = [profile.address, profile.locality].filter(Boolean).join(", ");
  return (
    <AppointmentView
      token={token}
      shop={{
        name: profile.name,
        locality: profile.locality,
        slug: profile.slug,
        whatsapp: profile.whatsappPhone
          ? whatsappUrl(profile.whatsappPhone)
          : null,
        directions: directionsUrl(profile),
      }}
      appointment={{
        startsAt: appointment.start.toISOString(),
        when: whenLine(date, time),
        isToday: date === toBogotaDate(now()),
        services,
        barber: appointment.barberName,
        place: place || null,
        price: formatPesos(appointment.priceCop),
        calendar: calendarUrl(
          textos.reservas.confirmada.calendarioTitulo(profile.name),
          appointment.start,
          appointment.end,
          [profile.name, place].filter(Boolean).join(", "),
        ),
      }}
      customerName={appointment.customerFirstName}
      noticeHours={appointment.cancellationNoticeHours}
      changeable={appointment.changeable}
      canMove={canMove}
      changed={selection.changed}
      moveHref={
        routes.manageAppointment(token) + manageQuery({ step: "cambiar" })
      }
    />
  );
}
