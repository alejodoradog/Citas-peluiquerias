import Link from "next/link";
import {
  formatCalendarDay,
  formatWallClock,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { publicImageUrl } from "@/lib/imagenes/keys";
import { routes } from "@/lib/routes";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  FIRST_AVAILABLE,
  type BookingSelection,
} from "@/modulos/agenda/dominio/booking-flow";
import { Avatar } from "@/ui/avatar";
import { ButtonLink } from "@/ui/button";
import { ChevronRightIcon, UsersIcon } from "@/ui/icons";
import { EmptyState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { StepHeader, StepTitle } from "../booking-ui";
import { servicesLine } from "./summary";

const t = textos.reservas;

const option =
  "flex min-h-18 items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-ink no-underline";

// C-03: "El primero disponible" and the barbers who do every chosen service,
// each with its first free time.
export function BarberStep({
  profile,
  selection,
  availability,
  today,
}: {
  profile: PublicProfile;
  selection: BookingSelection;
  availability: PublicAvailability;
  today: string;
}) {
  const flow = routes.bookingFlow(profile.slug);
  const toTime = (barber: string) =>
    flow + bookingQuery({ serviceIds: selection.serviceIds, barber });

  function firstFree(barberId: string): string {
    for (const day of availability.days) {
      const slot = day.slots.find((s) => s.barberIds.includes(barberId));
      if (slot) {
        const time = formatWallClock(toBogotaTime(slot.start));
        return day.date === today
          ? t.barbero.hoyDesde(time)
          : t.barbero.desde(formatCalendarDay(day.date), time);
      }
    }
    return t.barbero.sinHoras;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <StepHeader
        shopName={profile.name}
        backHref={
          flow +
          bookingQuery({ serviceIds: selection.serviceIds, step: "servicios" })
        }
        step={2}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2.5 px-5 pt-2.5 pb-5">
        <p className="text-help text-muted">{servicesLine(availability)}</p>
        <StepTitle title={t.barbero.titulo} intro={t.barbero.bajada} />
        {availability.barbers.length === 0 ? (
          <EmptyState
            title={t.barbero.nadie.titulo}
            action={
              <ButtonLink
                href={
                  flow +
                  bookingQuery({
                    serviceIds: selection.serviceIds,
                    step: "servicios",
                  })
                }
                variant="secondary"
                size="md"
              >
                {t.barbero.nadie.accion}
              </ButtonLink>
            }
          >
            {t.barbero.nadie.bajada}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            <li>
              <Link
                href={toTime(FIRST_AVAILABLE)}
                className={`${option} border-brand border-2`}
              >
                <span className="bg-brand-soft text-brand-strong flex size-11 shrink-0 items-center justify-center rounded-full">
                  <UsersIcon size={20} />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-base font-bold">
                    {t.barbero.primero}
                  </span>
                  <span className="text-help text-muted">
                    {t.barbero.primeroDetalle}
                  </span>
                </span>
                <span className="text-muted">
                  <ChevronRightIcon size={20} />
                </span>
              </Link>
            </li>
            {availability.barbers.map((barber) => (
              <li key={barber.id}>
                <Link
                  href={toTime(barber.id)}
                  className={`${option} border-line border`}
                >
                  <Avatar
                    name={barber.name}
                    size="md"
                    photoUrl={
                      barber.photoPath
                        ? publicImageUrl(barber.photoPath)
                        : undefined
                    }
                  />
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-base font-bold">{barber.name}</span>
                    <span className="text-help text-muted">
                      {firstFree(barber.id)}
                    </span>
                  </span>
                  <span className="text-muted">
                    <ChevronRightIcon size={20} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
