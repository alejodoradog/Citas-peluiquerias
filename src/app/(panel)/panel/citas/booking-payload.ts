import { toBogotaDate, type BogotaDate } from "@/lib/fechas/fechas";
import type {
  OwnerBookingData,
  OwnerService,
} from "@/modulos/agenda/datos/owner-appointment";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import type { AgendaBarber } from "@/modulos/agenda/dominio/owner-agenda";

// What D-37 and D-38 send to the browser to offer free times there, without
// a round trip per choice (task 4.2): the active barbers, what each offers,
// the hours, and when each barber is busy for the next 30 days. No names of
// customers: the browser only needs the times.
export type BookingPayload = {
  now: Date;
  today: BogotaDate;
  barbers: AgendaBarber[];
  services: OwnerService[];
  offers: Record<string, string[]>;
  shopHours: WeeklyShift[];
  holidayOpenings: BogotaDate[];
  appointments: { id: string; barberId: string; start: Date; end: Date }[];
  blocks: { barberId: string | null; start: Date; end: Date }[];
};

export function bookingPayload(
  data: OwnerBookingData,
  now: Date,
): BookingPayload {
  return {
    now,
    today: toBogotaDate(now),
    barbers: data.barbers.filter((barber) => barber.active),
    services: data.services,
    offers: data.offers,
    shopHours: [...data.shopHours],
    holidayOpenings: [...data.holidayOpenings],
    appointments: data.appointments.map((a) => ({
      id: a.id,
      barberId: a.barberId,
      start: a.start,
      end: a.end,
    })),
    blocks: data.blocks.map((b) => ({
      barberId: b.barberId,
      start: b.start,
      end: b.end,
    })),
  };
}

// The barbers who do every one of the services.
export function barbersFor(
  payload: Pick<BookingPayload, "barbers" | "offers">,
  serviceIds: readonly string[],
): AgendaBarber[] {
  return payload.barbers.filter((barber) =>
    serviceIds.every((id) => payload.offers[barber.id]?.includes(id)),
  );
}
