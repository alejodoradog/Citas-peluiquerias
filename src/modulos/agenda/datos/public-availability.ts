import "server-only";
import { addDays, startOfBogotaDay } from "@/lib/fechas/fechas";
import {
  availableSlots,
  bookingWindow,
  type BusyAppointment,
  type DayAvailability,
} from "../dominio/availability";
import { bookingDuration, eligibleBarbers } from "../dominio/booking";
import { FIRST_AVAILABLE } from "../dominio/booking-flow";
import type {
  PublicBarber,
  PublicProfile,
  PublicService,
} from "./public-booking";
import { loadBusyTimes } from "./public-booking";

// The free times of a selection (C-03, C-04), always live: the profile
// (short cache) plus the blocks and busy ranges of the whole booking window,
// through the engine of task 3.1. The database checks the booking again.

export type PublicAvailability = {
  services: PublicService[];
  durationMinutes: number;
  priceCop: number;
  // Active barbers who do every chosen service (eligibleBarbers).
  barbers: PublicBarber[];
  days: DayAvailability[];
  appointments: BusyAppointment[];
};

// Null when the services are not all offered, or add up to more than the
// longest booking: the customer chooses them again.
export function chosenServices(
  profile: PublicProfile,
  serviceIds: readonly string[],
): { services: PublicService[]; minutes: number; priceCop: number } | null {
  const services = serviceIds.map((id) =>
    profile.services.find((service) => service.id === id),
  );
  if (services.some((service) => service === undefined)) return null;
  const chosen = services as PublicService[];
  const duration = bookingDuration(
    chosen.map((s) => ({ id: s.id, durationMinutes: s.durationMinutes })),
  );
  if (!duration.ok) return null;
  return {
    services: chosen,
    minutes: duration.minutes,
    priceCop: chosen.reduce((sum, s) => sum + s.priceCop, 0),
  };
}

export async function loadPublicAvailability(
  profile: PublicProfile,
  serviceIds: readonly string[],
  // A barber id, FIRST_AVAILABLE, or null for every eligible barber (C-03).
  barber: string | null,
  now: Date,
): Promise<PublicAvailability | null> {
  const chosen = chosenServices(profile, serviceIds);
  if (!chosen) return null;
  const eligible = eligibleBarbers(
    profile.barbers.map((b) => ({ ...b, active: true })),
    serviceIds,
  );
  const barbers =
    barber === null || barber === FIRST_AVAILABLE
      ? eligible
      : eligible.filter((b) => b.id === barber);

  const window = bookingWindow(now);
  const busy =
    barbers.length > 0
      ? await loadBusyTimes(
          profile.id,
          startOfBogotaDay(window.from),
          startOfBogotaDay(addDays(window.until, 1)),
        )
      : { blocks: [], appointments: [] };
  const ids = new Set(barbers.map((b) => b.id));
  const appointments = busy.appointments.filter((a) => ids.has(a.barberId));

  const days = availableSlots({
    now,
    fromDate: window.from,
    toDate: window.until,
    durationMinutes: chosen.minutes,
    minNoticeMinutes: profile.minBookingNoticeMinutes,
    shopHours: profile.shopHours,
    holidayOpenings: profile.holidayOpenings,
    barbers: barbers.map((b) => ({
      id: b.id,
      sortOrder: b.sortOrder,
      usesBarbershopHours: b.usesBarbershopHours,
      shifts: b.shifts,
    })),
    blocks: busy.blocks.filter(
      (block) => block.barberId === null || ids.has(block.barberId),
    ),
    appointments,
  });

  return {
    services: chosen.services,
    durationMinutes: chosen.minutes,
    priceCop: chosen.priceCop,
    barbers,
    days,
    appointments,
  };
}
