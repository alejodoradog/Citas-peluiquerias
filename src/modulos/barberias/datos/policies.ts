import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Policies } from "../dominio/policies";

// D-60. Sessions update only the barbershop columns granted to them, and RLS
// keeps them to their own barbershops; the filter by id keeps a second
// barbershop of the same owner out.

export async function getPolicies(barbershopId: string): Promise<Policies> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .select(
      "min_booking_notice_minutes, cancellation_notice_hours, booking_interval_minutes",
    )
    .eq("id", barbershopId)
    .single();
  if (error) throw error;
  return {
    minBookingNoticeMinutes: data.min_booking_notice_minutes,
    cancellationNoticeHours: data.cancellation_notice_hours,
    bookingIntervalMinutes: data.booking_interval_minutes,
  };
}

// False when nothing was written: RLS hid the row, or the database refused
// the values (its checks keep them in 0-10080 minutes and 0-168 hours).
export async function updatePolicies(
  barbershopId: string,
  policies: Policies,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .update({
      min_booking_notice_minutes: policies.minBookingNoticeMinutes,
      cancellation_notice_hours: policies.cancellationNoticeHours,
      booking_interval_minutes: policies.bookingIntervalMinutes,
    })
    .eq("id", barbershopId)
    .select("id");
  if (error) return false;
  return data.length === 1;
}
