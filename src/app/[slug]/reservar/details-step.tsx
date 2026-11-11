import Link from "next/link";
import { routes } from "@/lib/routes";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  type BookingSelection,
} from "@/modulos/agenda/dominio/booking-flow";
import { textos } from "@/ui/textos";
import { StepHeader, StepTitle } from "../booking-ui";
import { DetailsForm } from "./details-form";
import { barberName, servicesLine, whenLine } from "./summary";

const t = textos.reservas;

// C-06: the chosen time and the customer's details.
export function DetailsStep({
  profile,
  selection,
  availability,
}: {
  profile: PublicProfile;
  selection: BookingSelection;
  availability: PublicAvailability;
}) {
  const flow = routes.bookingFlow(profile.slug);
  const toTime =
    flow +
    bookingQuery({
      serviceIds: selection.serviceIds,
      barber: selection.barber,
      date: selection.date,
      time: selection.time,
      step: "hora",
    });
  const who = barberName(profile, selection.barber);
  return (
    <DetailsForm
      header={<StepHeader shopName={profile.name} backHref={toTime} step={4} />}
      hidden={{
        slug: profile.slug,
        servicios: selection.serviceIds,
        barbero: selection.barber!,
        dia: selection.date!,
        hora: selection.time!,
      }}
      priceCop={availability.priceCop}
      servicesHref={
        flow +
        bookingQuery({ step: "servicios", serviceIds: selection.serviceIds })
      }
    >
      <StepTitle title={t.datos.titulo} />
      <div className="border-line rounded-card flex flex-col gap-1 border bg-white px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.9375rem] font-bold">
            {whenLine(selection.date!, selection.time!)}
          </span>
          <Link
            href={toTime}
            className="text-brand-strong flex min-h-11 items-center text-sm font-bold"
          >
            {t.datos.cambiar}
          </Link>
        </div>
        <p className="text-muted text-sm">
          {servicesLine(availability)}
          {who ? ` · ${who}` : ""}
        </p>
      </div>
    </DetailsForm>
  );
}
