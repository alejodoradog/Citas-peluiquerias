import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nextSortOrder, type TeamBarberErrorCode } from "../dominio/barber";
import type { WeeklyShift } from "../dominio/hours";
import { isId } from "../dominio/service";
import { toBarberFieldError, type BarberFormField } from "./barber-errors";

// The team of the owner's barbershop (Más › Barberos, D-53 and D-54). Every
// query also filters by barbershop: RLS already limits rows to the owner's
// barbershops, and the filter keeps a second barbershop of the same owner
// out. A deleted professional ("Profesional eliminado", task 7.6c) is no
// longer part of the team: it stays in the database only for the past
// appointments, so the team's lists and the card leave it out.

const BARBER_COLUMNS =
  "id, display_name, photo_path, email, email_notifications, active, deactivated_at, is_owner, uses_barbershop_hours, sort_order";

export type BarberRow = {
  id: string;
  display_name: string;
  photo_path: string | null;
  email: string | null;
  email_notifications: boolean;
  active: boolean;
  deactivated_at: string | null;
  is_owner: boolean;
  uses_barbershop_hours: boolean;
  sort_order: number;
  // The active services they do. An inactive service keeps its pairs for
  // when it comes back (set_barber_services), but does not count here.
  service_ids: string[];
};

export type BarberDetail = BarberRow & {
  // Their own weekly hours; empty while they use the barbershop's.
  shifts: WeeklyShift[];
};

export type ServiceOption = { id: string; name: string };

type BarberValues = {
  displayName: string;
  email: string | null;
  emailNotifications: boolean;
};

export type BarberWriteResult =
  | { ok: true; id: string }
  | {
      ok: false;
      field: BarberFormField;
      code: TeamBarberErrorCode | "photo_invalid" | "invalid";
    }
  | { ok: false; field?: undefined; code: "unknown" }
  // Task 7.8: the plan allows no more active professionals.
  | { ok: false; field?: undefined; code: "plan_limit" };

// The services a barber can do: the active ones, by name.
export async function listActiveServiceOptions(
  barbershopId: string,
): Promise<ServiceOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name")
    .eq("barbershop_id", barbershopId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

async function activeServiceIds(barbershopId: string): Promise<Set<string>> {
  const services = await listActiveServiceOptions(barbershopId);
  return new Set(services.map((service) => service.id));
}

export async function listBarbers(barbershopId: string): Promise<BarberRow[]> {
  const supabase = await createSupabaseServerClient();
  const [barbers, pairs, active] = await Promise.all([
    supabase
      .from("barbers")
      .select(BARBER_COLUMNS)
      .eq("barbershop_id", barbershopId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("barbershop_id", barbershopId),
    activeServiceIds(barbershopId),
  ]);
  if (barbers.error) throw barbers.error;
  if (pairs.error) throw pairs.error;
  return barbers.data.map((barber) => ({
    ...barber,
    service_ids: pairs.data
      .filter(
        (pair) => pair.barber_id === barber.id && active.has(pair.service_id),
      )
      .map((pair) => pair.service_id),
  }));
}

// Null when the id is not an id, there is no such barber, RLS hides it
// (another barbershop's), or it was deleted (task 7.6c).
export async function getBarber(
  barbershopId: string,
  id: string,
): Promise<BarberDetail | null> {
  if (!isId(id)) return null;
  const supabase = await createSupabaseServerClient();
  const [barber, pairs, shifts, active] = await Promise.all([
    supabase
      .from("barbers")
      .select(BARBER_COLUMNS)
      .eq("barbershop_id", barbershopId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("barber_services")
      .select("service_id")
      .eq("barbershop_id", barbershopId)
      .eq("barber_id", id),
    supabase
      .from("barber_schedules")
      .select("weekday, start_time, end_time")
      .eq("barbershop_id", barbershopId)
      .eq("barber_id", id)
      .order("weekday")
      .order("start_time"),
    activeServiceIds(barbershopId),
  ]);
  if (barber.error) throw barber.error;
  if (pairs.error) throw pairs.error;
  if (shifts.error) throw shifts.error;
  if (!barber.data) return null;
  return {
    ...barber.data,
    service_ids: pairs.data
      .map((pair) => pair.service_id)
      .filter((serviceId) => active.has(serviceId)),
    shifts: shifts.data.map((row) => ({
      weekday: row.weekday,
      start: row.start_time.slice(0, 5),
      end: row.end_time.slice(0, 5),
    })),
  };
}

export type OwnHoursBarber = {
  id: string;
  displayName: string;
  usesBarbershopHours: false;
  shifts: WeeklyShift[];
};

// The active barbers with hours of their own, in the team's order, with their
// week: D-58 warns about those whose hours go beyond the barbershop's.
export async function listOwnHoursBarbers(
  barbershopId: string,
): Promise<OwnHoursBarber[]> {
  const supabase = await createSupabaseServerClient();
  const [barbers, shifts] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .eq("uses_barbershop_hours", false)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("barber_schedules")
      .select("barber_id, weekday, start_time, end_time")
      .eq("barbershop_id", barbershopId)
      .order("weekday")
      .order("start_time"),
  ]);
  if (barbers.error) throw barbers.error;
  if (shifts.error) throw shifts.error;
  return barbers.data.map((barber) => ({
    id: barber.id,
    displayName: barber.display_name,
    usesBarbershopHours: false,
    shifts: shifts.data
      .filter((row) => row.barber_id === barber.id)
      .map((row) => ({
        weekday: row.weekday,
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
      })),
  }));
}

// Whether another barber of the barbershop already shows this photo, so one
// barber's replaced photo never deletes another's.
export async function photoInUse(
  barbershopId: string,
  path: string,
  exceptBarberId: string | null,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("barbers")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .eq("photo_path", path);
  if (exceptBarberId) query = query.neq("id", exceptBarberId);
  const { data, error } = await query;
  if (error) throw error;
  return data.length > 0;
}

function failure(error: {
  code?: string;
  message?: string;
  hint?: string | null;
}) {
  if (error.hint === "plan_limit") {
    return { ok: false, code: "plan_limit" } as const;
  }
  const field = toBarberFieldError(error);
  return field
    ? ({ ok: false, ...field } as const)
    : ({ ok: false, code: "unknown" } as const);
}

// A new barber, last in the team. Never the owner: the owner's barber comes
// from the wizard. The old link columns take their defaults (task 7.6c).
export async function insertBarber(
  barbershopId: string,
  values: BarberValues & { photoPath: string | null },
): Promise<BarberWriteResult> {
  const supabase = await createSupabaseServerClient();
  const orders = await supabase
    .from("barbers")
    .select("sort_order")
    .eq("barbershop_id", barbershopId);
  if (orders.error) return { ok: false, code: "unknown" };

  const { data, error } = await supabase
    .from("barbers")
    .insert({
      barbershop_id: barbershopId,
      display_name: values.displayName,
      email: values.email,
      email_notifications: values.emailNotifications,
      photo_path: values.photoPath,
      sort_order: nextSortOrder(orders.data.map((row) => row.sort_order)),
    })
    .select("id")
    .single();
  if (error) return failure(error);
  return { ok: true, id: data.id };
}

// Zero rows updated means the id is not one of this barbershop's barbers:
// "unknown", like any failure. photoPath undefined keeps the photo.
export async function updateBarberRow(
  barbershopId: string,
  id: string,
  values: BarberValues & { photoPath?: string },
): Promise<BarberWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbers")
    .update({
      display_name: values.displayName,
      email: values.email,
      email_notifications: values.emailNotifications,
      ...(values.photoPath !== undefined
        ? { photo_path: values.photoPath }
        : {}),
    })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .select("id");
  if (error) return failure(error);
  if (data.length !== 1) return { ok: false, code: "unknown" };
  return { ok: true, id };
}

export async function clearBarberPhoto(
  barbershopId: string,
  id: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbers")
    .update({ photo_path: null })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .select("id");
  return !error && data.length === 1;
}

// Deactivates or brings back a barber. The trigger stamps deactivated_at.
// Their account and their appointments stay as they are (decision 6).
export async function setBarberActiveRow(
  barbershopId: string,
  id: string,
  active: boolean,
): Promise<"saved" | "plan_limit" | "failed"> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbers")
    .update({ active })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .select("id");
  // Task 7.8: reactivating one more than the plan allows.
  if (error?.hint === "plan_limit") return "plan_limit";
  return !error && data.length === 1 ? "saved" : "failed";
}

// Replaces which active services the barber does (set_barber_services,
// security invoker: RLS applies). Fails with P0002 when the barber or a
// service is not one of the same barbershop, or the service is inactive.
export async function setBarberServices(
  barberId: string,
  serviceIds: readonly string[],
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_barber_services", {
    p_barber_id: barberId,
    p_service_ids: [...serviceIds],
  });
  return !error;
}

export type ScheduleWriteResult = "saved" | "overlap" | "failed";

// Switches a barber between the barbershop's hours and their own, shifts
// included, in one transaction (set_barber_schedule, security invoker: RLS
// applies). 23P01 is the exclusion constraint of barber_schedules: two
// shifts of a day overlap. P0002 (not one of the owner's barbers) and
// shifts_invalid fail like anything else.
export async function setBarberSchedule(
  barberId: string,
  usesBarbershopHours: boolean,
  shifts: ReadonlyArray<{ weekday: number; start: string; end: string }>,
): Promise<ScheduleWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_barber_schedule", {
    p_barber_id: barberId,
    p_uses_barbershop_hours: usesBarbershopHours,
    p_shifts: shifts.map(({ weekday, start, end }) => ({
      weekday,
      start,
      end,
    })),
  });
  if (!error) return "saved";
  return error.code === "23P01" ? "overlap" : "failed";
}

// How many appointments the professional still has to come (confirmed and
// not over), as delete_barber counts them: "Eliminar" explains them before
// the owner taps. The database checks it again when deleting.
export async function countUpcomingAppointments(
  barbershopId: string,
  barberId: string,
): Promise<number> {
  // An id from the URL that is not one is "not found" before this matters.
  if (!isId(barberId)) return 0;
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId)
    .eq("barber_id", barberId)
    .eq("status", "confirmed")
    .gt("ends_at", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

export type DeleteBarberResult =
  | { ok: true; photoPath: string | null }
  // Already deleted (a second tap, or a retry): what is left is the account.
  | { ok: false; code: "barber_deleted" }
  | { ok: false; code: "has_upcoming_appointments"; upcoming: number }
  | { ok: false; code: "barber_is_owner" | "barber_not_found" | "unknown" };

// delete_barber (task 7.6c): with the owner's own session, which the
// database checks reaches the professional. Returns the photo it cleared,
// for the action to delete in Storage.
export async function deleteBarberRow(
  barberId: string,
): Promise<DeleteBarberResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("delete_barber", {
    p_barber_id: barberId,
  });
  if (!error) return { ok: true, photoPath: data ?? null };
  switch (error.hint) {
    case "has_upcoming_appointments":
      return {
        ok: false,
        code: "has_upcoming_appointments",
        upcoming: Number.parseInt(error.details ?? "", 10) || 1,
      };
    case "barber_deleted":
    case "barber_is_owner":
    case "barber_not_found":
      return { ok: false, code: error.hint };
    default:
      return { ok: false, code: "unknown" };
  }
}
