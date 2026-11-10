import "server-only";
import { newLinkTokenHash } from "@/lib/tokens/link-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nextSortOrder, type TeamBarberErrorCode } from "../dominio/barber";
import type { WeeklyShift } from "../dominio/hours";
import { isId } from "../dominio/service";
import { toBarberFieldError, type BarberFormField } from "./barber-errors";

// The team of the owner's barbershop (Más › Barberos, D-53 and D-54). Every
// query also filters by barbershop: RLS already limits rows to the owner's
// barbershops, and the filter keeps a second barbershop of the same owner
// out. link_token_hash is never read: sessions cannot select it anyway.

const BARBER_COLUMNS =
  "id, display_name, photo_path, email, email_notifications, active, deactivated_at, is_owner, uses_barbershop_hours, link_active, sort_order";

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
  link_active: boolean;
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
  | { ok: false; field?: undefined; code: "unknown" };

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

// Null when the id is not an id, there is no such barber, or RLS hides it
// (another barbershop's).
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

function failure(error: { code?: string; message?: string }) {
  const field = toBarberFieldError(error);
  return field
    ? ({ ok: false, ...field } as const)
    : ({ ok: false, code: "unknown" } as const);
}

// A new barber, last in the team, with a private link whose token nobody
// knows yet: the hash is stored and the token thrown away (task 2.3 issues
// the link). Never the owner: the owner's barber comes from the wizard.
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
      link_token_hash: newLinkTokenHash(),
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
// Their link and their appointments stay as they are (decision 6).
export async function setBarberActiveRow(
  barbershopId: string,
  id: string,
  active: boolean,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbers")
    .update({ active })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .select("id");
  return !error && data.length === 1;
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
