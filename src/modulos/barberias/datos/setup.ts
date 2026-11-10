import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WeeklyShift } from "../dominio/hours";
import type { SetupPayload } from "../dominio/setup";

// A barbershop without services has not finished the setup wizard (task 2.1):
// the panel sends its owner there. RLS keeps the query to their barbershops.
export async function barbershopNeedsSetup(
  barbershopId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .limit(1);
  if (error) throw error;
  return data.length === 0;
}

export async function countActiveBarbers(
  barbershopId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("barbers")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId)
    .eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function getBarbershopHours(
  barbershopId: string,
): Promise<WeeklyShift[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershop_hours")
    .select("weekday, start_time, end_time")
    .eq("barbershop_id", barbershopId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return data.map((row) => ({
    weekday: row.weekday,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
  }));
}

export type SetupSaveResult = "saved" | "already_done" | "failed";

// Saves the whole wizard in one transaction (complete_barbershop_setup).
// "already_done" covers a second tap or a second tab: the setup exists.
export async function completeBarbershopSetup(
  barbershopId: string,
  hours: readonly WeeklyShift[],
  payload: SetupPayload,
): Promise<SetupSaveResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_barbershop_setup", {
    p_barbershop_id: barbershopId,
    p_hours: hours.map((shift) => ({
      weekday: shift.weekday,
      start_time: shift.start,
      end_time: shift.end,
    })),
    p_services: payload.services,
    p_barbers: payload.barbers,
  });
  if (!error) return "saved";
  if (error.hint === "setup_done") return "already_done";
  return "failed";
}
