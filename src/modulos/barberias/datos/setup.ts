import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WeeklyShift } from "../dominio/hours";
import type { SetupPayload } from "../dominio/setup";

// Whether a barbershop still needs the setup wizard (task 2.1) is not read
// here: it comes with the owner's access (getCurrentAccess), in the same query
// as the active barbershop, so no screen or action spends a round trip on it.

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

export type ShopHoursWriteResult = "saved" | "overlap" | "closed" | "failed";

// D-58: the whole week in one transaction (set_barbershop_hours). The
// function checks membership itself, and refuses a week without open days
// (hours_required) and shifts that overlap (23P01, barbershop_hours_no_overlap).
export async function setBarbershopHours(
  barbershopId: string,
  shifts: ReadonlyArray<{ weekday: number; start: string; end: string }>,
): Promise<ShopHoursWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_barbershop_hours", {
    p_barbershop_id: barbershopId,
    p_shifts: shifts.map(({ weekday, start, end }) => ({
      weekday,
      start,
      end,
    })),
  });
  if (!error) return "saved";
  if (error.code === "23P01") return "overlap";
  if (error.hint === "hours_required") return "closed";
  return "failed";
}

// location_required: the database refuses to finish without the point
// (task 7.3).
// plan_limit: more active professionals than the plan allows (task 7.8).
export type SetupSaveResult =
  | "saved"
  | "already_done"
  | "location_required"
  | "plan_limit"
  | "failed";

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
  if (error.hint === "location_required") return "location_required";
  if (error.hint === "plan_limit") return "plan_limit";
  return "failed";
}
