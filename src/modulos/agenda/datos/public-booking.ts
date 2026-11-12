import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicProfileTag } from "@/lib/cache-tags";
import type { BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { WeeklyShift } from "@/modulos/barberias/dominio/hours";
import { isSlug } from "@/modulos/barberias/dominio/slug";
import type { BusyAppointment, TimeBlock } from "../dominio/availability";

// What the public booking page reads, always as anon (decision 0002, point
// 3): exactly what anyone with the link may see. anon reads no appointment
// and no customer; the busy times come from booking_busy_ranges.

export type PublicService = {
  id: string;
  name: string;
  priceCop: number;
  durationMinutes: number;
};

export type PublicBarber = {
  id: string;
  name: string;
  photoPath: string | null;
  sortOrder: number;
  usesBarbershopHours: boolean;
  serviceIds: string[];
  shifts: WeeklyShift[];
};

export type PublicProfile = {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
  coverPhotoPath: string | null;
  address: string | null;
  locality: string | null;
  location: { latitude: number; longitude: number } | null;
  whatsappPhone: string | null;
  minBookingNoticeMinutes: number;
  cancellationNoticeHours: number;
  deposit: { method: string; account: string } | null;
  acceptsBookings: boolean;
  services: PublicService[];
  barbers: PublicBarber[];
  shopHours: WeeklyShift[];
  holidayOpenings: BogotaDate[];
};

function failIf(error: unknown): void {
  if (error) throw error;
}

// Cached for a short time (task 3.2: "el perfil público va en caché
// corta"), and refreshed at once by the owner's actions (cache-tags.ts).
// Null when no barbershop uses the link.
export async function loadPublicProfile(
  slug: string,
): Promise<PublicProfile | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  if (!isSlug(slug)) return null;
  const supabase = createSupabasePublicClient();

  const shop = await supabase
    .from("barbershops")
    .select(
      "id, name, slug, logo_path, cover_photo_path, address, locality, latitude, longitude, whatsapp_phone, min_booking_notice_minutes, cancellation_notice_hours, deposit_method, deposit_account",
    )
    .eq("slug", slug)
    .maybeSingle();
  failIf(shop.error);
  if (!shop.data) return null;
  const b = shop.data;
  cacheTag(publicProfileTag(b.id));

  const [
    accepts,
    services,
    barbers,
    barberServices,
    schedules,
    hours,
    holidays,
  ] = await Promise.all([
    supabase.rpc("barbershop_accepts_bookings", { p_barbershop_id: b.id }),
    supabase
      .from("services")
      .select("id, name, price_cop, duration_minutes")
      .eq("barbershop_id", b.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name, photo_path, sort_order, uses_barbershop_hours")
      .eq("barbershop_id", b.id)
      .eq("active", true)
      .order("sort_order")
      .order("id"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("barbershop_id", b.id),
    supabase
      .from("barber_schedules")
      .select("barber_id, weekday, start_time, end_time")
      .eq("barbershop_id", b.id),
    supabase
      .from("barbershop_hours")
      .select("weekday, start_time, end_time")
      .eq("barbershop_id", b.id),
    supabase
      .from("holiday_openings")
      .select("holiday_date")
      .eq("barbershop_id", b.id),
  ]);
  for (const result of [
    accepts,
    services,
    barbers,
    barberServices,
    schedules,
    hours,
    holidays,
  ]) {
    failIf(result.error);
  }

  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    logoPath: b.logo_path,
    coverPhotoPath: b.cover_photo_path,
    address: b.address,
    locality: b.locality,
    location:
      b.latitude !== null && b.longitude !== null
        ? { latitude: b.latitude, longitude: b.longitude }
        : null,
    whatsappPhone: b.whatsapp_phone,
    minBookingNoticeMinutes: b.min_booking_notice_minutes,
    cancellationNoticeHours: b.cancellation_notice_hours,
    deposit:
      b.deposit_method && b.deposit_account
        ? { method: b.deposit_method, account: b.deposit_account }
        : null,
    acceptsBookings: accepts.data === true,
    services: (services.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      priceCop: s.price_cop,
      durationMinutes: s.duration_minutes,
    })),
    barbers: (barbers.data ?? []).map((barber) => ({
      id: barber.id,
      name: barber.display_name,
      photoPath: barber.photo_path,
      sortOrder: barber.sort_order,
      usesBarbershopHours: barber.uses_barbershop_hours,
      serviceIds: (barberServices.data ?? [])
        .filter((line) => line.barber_id === barber.id)
        .map((line) => line.service_id),
      shifts: (schedules.data ?? [])
        .filter((shift) => shift.barber_id === barber.id)
        .map((shift) => ({
          weekday: shift.weekday,
          start: shift.start_time,
          end: shift.end_time,
        })),
    })),
    shopHours: (hours.data ?? []).map((shift) => ({
      weekday: shift.weekday,
      start: shift.start_time,
      end: shift.end_time,
    })),
    holidayOpenings: (holidays.data ?? []).map((row) => row.holiday_date),
  };
}

// The busy times of [from, until), live (never cached): the blocks anon
// reads and the ranges of booking_busy_ranges (at most 32 days).
export async function loadBusyTimes(
  barbershopId: string,
  from: Date,
  until: Date,
): Promise<{ blocks: TimeBlock[]; appointments: BusyAppointment[] }> {
  const supabase = createSupabasePublicClient();
  const [blocks, ranges] = await Promise.all([
    supabase
      .from("time_blocks")
      .select("barber_id, starts_at, ends_at")
      .eq("barbershop_id", barbershopId)
      .lt("starts_at", until.toISOString())
      .gt("ends_at", from.toISOString()),
    supabase.rpc("booking_busy_ranges", {
      p_barbershop_id: barbershopId,
      p_from: from.toISOString(),
      p_until: until.toISOString(),
    }),
  ]);
  failIf(blocks.error);
  failIf(ranges.error);
  return {
    blocks: (blocks.data ?? []).map((block) => ({
      barberId: block.barber_id,
      start: new Date(block.starts_at),
      end: new Date(block.ends_at),
    })),
    appointments: (ranges.data ?? []).map((range) => ({
      barberId: range.barber_id,
      start: new Date(range.starts_at),
      end: new Date(range.ends_at),
    })),
  };
}

export type NewPublicBooking = {
  barbershopId: string;
  // Null: "el primero disponible".
  barberId: string | null;
  startsAt: Date;
  serviceIds: readonly string[];
  name: string;
  email: string;
  phone: string | null;
  // Only the SHA-256 of the manage token; the token never reaches the
  // database.
  manageTokenHash: string;
  // The keyed hash of the visitor's IP (client-ip.ts), or null when there is
  // none: the limit of bookings per IP (task 3.5).
  clientIpHash: string | null;
};

// book_appointment_from_app as the app's server (task 3.5): since then only
// the server books, after Turnstile, so a script with the publishable key
// cannot skip it. The database checks everything again, with the limits per
// IP and per email, and answers the appointment and the barber who takes it.
export async function createPublicBooking(
  booking: NewPublicBooking,
): Promise<
  | { ok: true; appointmentId: string; barberId: string }
  | { ok: false; error: { code?: string; hint?: string | null } }
> {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "book_appointment_from_app",
    {
      p_barbershop_id: booking.barbershopId,
      p_starts_at: booking.startsAt.toISOString(),
      p_service_ids: [...booking.serviceIds],
      p_customer_name: booking.name,
      p_customer_email: booking.email,
      p_manage_token_hash: booking.manageTokenHash,
      ...(booking.barberId ? { p_barber_id: booking.barberId } : {}),
      ...(booking.phone ? { p_customer_phone: booking.phone } : {}),
      ...(booking.clientIpHash
        ? { p_client_ip_hash: booking.clientIpHash }
        : {}),
    },
  );
  const row = data?.[0];
  if (error || !row) return { ok: false, error: error ?? {} };
  return {
    ok: true,
    appointmentId: row.appointment_id,
    barberId: row.barber_id,
  };
}
