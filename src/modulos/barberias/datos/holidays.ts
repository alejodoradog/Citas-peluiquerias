import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Closure } from "../dominio/closures";
import type { HolidayWindow } from "../dominio/holidays";

// D-59. Every query filters by the barbershop of the session; RLS also keeps
// sessions inside their own barbershops (member_* policies).

// The holidays of the window the barbershop opens ("2026-12-25").
export async function getHolidayOpenings(
  barbershopId: string,
  window: HolidayWindow,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("holiday_openings")
    .select("holiday_date")
    .eq("barbershop_id", barbershopId)
    .gte("holiday_date", window.from)
    .lte("holiday_date", window.until)
    .order("holiday_date");
  if (error) throw error;
  return data.map((row) => row.holiday_date);
}

// The holidays of the window to open, the rest of it closed, in one
// transaction (set_holiday_openings, which checks membership itself).
export async function setHolidayOpenings(
  barbershopId: string,
  window: HolidayWindow,
  dates: readonly string[],
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_holiday_openings", {
    p_barbershop_id: barbershopId,
    p_from: window.from,
    p_until: window.until,
    p_dates: [...dates],
  });
  return !error;
}

export type SavedClosure = Closure & { id: string };

// Closures of the whole barbershop (time_blocks without barber) that have not
// ended, the next one first. A barber's own blocks (task 4.2) are not here.
const MAX_LISTED_CLOSURES = 100;

export async function listUpcomingClosures(
  barbershopId: string,
  now: Date,
): Promise<SavedClosure[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("time_blocks")
    .select("id, starts_at, ends_at, reason")
    .eq("barbershop_id", barbershopId)
    .is("barber_id", null)
    .gt("ends_at", now.toISOString())
    .order("starts_at")
    .limit(MAX_LISTED_CLOSURES);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    reason: row.reason,
  }));
}

export async function insertClosure(
  barbershopId: string,
  closure: Closure,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("time_blocks").insert({
    barbershop_id: barbershopId,
    barber_id: null,
    starts_at: closure.startsAt.toISOString(),
    ends_at: closure.endsAt.toISOString(),
    reason: closure.reason,
  });
  return !error;
}

// Only a closure of the whole barbershop, never a barber's block. A closure
// already gone (a second tap, another tab) counts as removed.
export async function deleteClosure(
  barbershopId: string,
  closureId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("time_blocks")
    .delete()
    .eq("barbershop_id", barbershopId)
    .eq("id", closureId)
    .is("barber_id", null);
  return !error;
}
