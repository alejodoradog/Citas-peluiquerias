import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isId, type ServiceErrorCode } from "../dominio/service";
import { toServiceFieldError, type ServiceFormField } from "./service-errors";

// Services of the owner's barbershop (Más › Servicios, D-51 and D-52). Every
// query also filters by barbershop: RLS already limits rows to the owner's
// barbershops, and the filter keeps a second barbershop of the same owner out.

export type ServiceRow = {
  id: string;
  name: string;
  price_cop: number;
  duration_minutes: number;
  active: boolean;
  // The active barbers who do it. An inactive barber keeps their pairs for
  // when they come back (set_service_barbers), but does not count here.
  barber_ids: string[];
};

export type ActiveBarber = { id: string; display_name: string };

type ServiceValues = {
  name: string;
  priceCop: number;
  durationMinutes: number;
};

export type ServiceWriteResult =
  | { ok: true; id: string }
  | { ok: false; field: ServiceFormField; code: ServiceErrorCode | "invalid" }
  | { ok: false; field?: undefined; code: "unknown" };

async function activeBarberIds(barbershopId: string): Promise<Set<string>> {
  const barbers = await listActiveBarbers(barbershopId);
  return new Set(barbers.map((barber) => barber.id));
}

export async function listServices(
  barbershopId: string,
): Promise<ServiceRow[]> {
  const supabase = await createSupabaseServerClient();
  const [services, pairs, active] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price_cop, duration_minutes, active")
      .eq("barbershop_id", barbershopId)
      .order("name"),
    supabase
      .from("barber_services")
      .select("service_id, barber_id")
      .eq("barbershop_id", barbershopId),
    activeBarberIds(barbershopId),
  ]);
  if (services.error) throw services.error;
  if (pairs.error) throw pairs.error;
  return services.data.map((service) => ({
    ...service,
    barber_ids: pairs.data
      .filter(
        (pair) => pair.service_id === service.id && active.has(pair.barber_id),
      )
      .map((pair) => pair.barber_id),
  }));
}

// Null when there is no such service, or RLS hides it (another barbershop's).
export async function getService(
  barbershopId: string,
  id: string,
): Promise<ServiceRow | null> {
  if (!isId(id)) return null;
  const supabase = await createSupabaseServerClient();
  const [service, pairs, active] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price_cop, duration_minutes, active")
      .eq("barbershop_id", barbershopId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("barber_services")
      .select("barber_id")
      .eq("barbershop_id", barbershopId)
      .eq("service_id", id),
    activeBarberIds(barbershopId),
  ]);
  if (service.error) throw service.error;
  if (pairs.error) throw pairs.error;
  if (!service.data) return null;
  return {
    ...service.data,
    barber_ids: pairs.data
      .map((pair) => pair.barber_id)
      .filter((barberId) => active.has(barberId)),
  };
}

// The barbers who can take a service: the active ones, in the team's order.
export async function listActiveBarbers(
  barbershopId: string,
): Promise<ActiveBarber[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbers")
    .select("id, display_name")
    .eq("barbershop_id", barbershopId)
    .eq("active", true)
    .order("sort_order")
    .order("display_name");
  if (error) throw error;
  return data;
}

// The counts next to Servicios and Barberos y horarios in Más (D-50).
export async function countActive(
  barbershopId: string,
): Promise<{ services: number; barbers: number }> {
  const supabase = await createSupabaseServerClient();
  const [services, barbers] = await Promise.all([
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
      .eq("active", true),
    supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", barbershopId)
      .eq("active", true),
  ]);
  if (services.error) throw services.error;
  if (barbers.error) throw barbers.error;
  return { services: services.count ?? 0, barbers: barbers.count ?? 0 };
}

// Ids and names of the barbershop's services, active or not: names do not
// repeat across both (decision 2 of task 2.2).
export async function listServiceNames(
  barbershopId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name")
    .eq("barbershop_id", barbershopId);
  if (error) throw error;
  return data;
}

function failure(error: { code?: string; message?: string }) {
  const field = toServiceFieldError(error);
  return field
    ? ({ ok: false, ...field } as const)
    : ({ ok: false, code: "unknown" } as const);
}

export async function insertService(
  barbershopId: string,
  values: ServiceValues,
): Promise<ServiceWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      barbershop_id: barbershopId,
      name: values.name,
      price_cop: values.priceCop,
      duration_minutes: values.durationMinutes,
    })
    .select("id")
    .single();
  if (error) return failure(error);
  return { ok: true, id: data.id };
}

// Zero rows updated means the id is not one of this barbershop's services
// (RLS and the barbershop filter both hide it): "unknown", like any failure.
export async function updateServiceRow(
  barbershopId: string,
  id: string,
  values: ServiceValues & { active: boolean },
): Promise<ServiceWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .update({
      name: values.name,
      price_cop: values.priceCop,
      duration_minutes: values.durationMinutes,
      active: values.active,
    })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .select("id");
  if (error) return failure(error);
  if (data.length !== 1) return { ok: false, code: "unknown" };
  return { ok: true, id };
}

// Replaces which active barbers do the service (set_service_barbers, security
// invoker: RLS applies). Fails with P0002 when the service or a barber is not
// an active one of the same barbershop.
export async function setServiceBarbers(
  serviceId: string,
  barberIds: readonly string[],
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_service_barbers", {
    p_service_id: serviceId,
    p_barber_ids: [...barberIds],
  });
  return !error;
}
