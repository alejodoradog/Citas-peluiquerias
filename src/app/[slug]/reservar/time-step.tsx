import { LiveRefresh } from "@/app/(panel)/panel/live-refresh";
import { routes } from "@/lib/routes";
import type { PublicAvailability } from "@/modulos/agenda/datos/public-availability";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import {
  bookingQuery,
  FIRST_AVAILABLE,
  type BookingSelection,
} from "@/modulos/agenda/dominio/booking-flow";
import { toDayTimes } from "./slot-days";
import { barberName, servicesLine } from "./summary";
import { TimeChooser } from "./time-chooser";

// C-04 (C-05 without free times, C-07 after someone took the time): the days
// of the booking window and the free times of the chosen one. The server
// sends the free times of the whole window; the day and the time are chosen
// in the browser (time-chooser.tsx). No tap asks the server again, so the
// step does it by itself every minute and when the customer comes back to
// the tab, as the owner's agenda does: what it offers never grows old.
export function TimeStep({
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
  const toBarber =
    flow + bookingQuery({ serviceIds: selection.serviceIds, step: "barbero" });
  const who = barberName(profile, selection.barber);

  return (
    <>
      <LiveRefresh />
      <TimeChooser
        shopName={profile.name}
        backHref={toBarber}
        continueHref={
          flow +
          bookingQuery({
            serviceIds: selection.serviceIds,
            barber: selection.barber,
          })
        }
        otherBarberHref={toBarber}
        days={toDayTimes(availability.days)}
        today={today}
        date={selection.date}
        time={selection.time}
        taken={selection.taken}
        intro={`${servicesLine(availability)}${who ? ` · ${who}` : ""}`}
        namedBarber={selection.barber !== FIRST_AVAILABLE ? who : null}
        priceCop={availability.priceCop}
      />
    </>
  );
}
