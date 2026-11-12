import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isId } from "@/modulos/barberias/dominio/service";
import { bookingWindow } from "../dominio/availability";
import type { AgendaData, AppointmentStatus } from "../dominio/owner-agenda";
import { loadOwnerAgenda } from "./owner-agenda";
import { toOwnerRefusal, type OwnerRefusal } from "./owner-appointment-errors";

// Task 4.2, with the owner's session. Reads go straight to the tables (RLS
// and the filter by the active barbershop keep them inside it, as in 4.1);
// writes go through the functions of migration add_owner_appointment_actions,
// which check the barbershop again and every rule of the time.

export type OwnerService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCop: number;
};

export type OwnerAppointmentDetail = {
  id: string;
  status: AppointmentStatus;
  source: "web" | "manual";
  createdAt: Date;
  start: Date;
  end: Date;
  priceCop: number;
  barber: { id: string; name: string };
  // As the appointment keeps them: the price and length of each line.
  services: OwnerService[];
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    // Attended and no-show appointments in this barbershop.
    visits: number;
    noShows: number;
    anonymized: boolean;
  };
};

// D-34. Null for an id that is not one, or an appointment of another
// barbershop.
export async function getOwnerAppointment(
  barbershopId: string,
  id: string,
): Promise<OwnerAppointmentDetail | null> {
  if (!isId(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, status, source, created_at, starts_at, ends_at, price_cop, barber_id, customer_id, barbers(display_name), customers(full_name, email, phone, anonymized_at), appointment_services(position, service_id, price_cop, duration_minutes, services(name))",
    )
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const history = await supabase
    .from("appointments")
    .select("status")
    .eq("barbershop_id", barbershopId)
    .eq("customer_id", data.customer_id)
    .in("status", ["attended", "no_show"]);
  if (history.error) throw history.error;

  return {
    id: data.id,
    status: data.status,
    source: data.source,
    createdAt: new Date(data.created_at),
    start: new Date(data.starts_at),
    end: new Date(data.ends_at),
    priceCop: data.price_cop,
    barber: { id: data.barber_id, name: data.barbers?.display_name ?? "" },
    services: [...data.appointment_services]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        id: line.service_id,
        name: line.services?.name ?? "",
        durationMinutes: line.duration_minutes,
        priceCop: line.price_cop,
      })),
    customer: {
      id: data.customer_id,
      name: data.customers?.full_name ?? "",
      email: data.customers?.email ?? null,
      phone: data.customers?.phone ?? null,
      visits: history.data.filter((row) => row.status === "attended").length,
      noShows: history.data.filter((row) => row.status === "no_show").length,
      anonymized: data.customers?.anonymized_at != null,
    },
  };
}

// What D-37 and D-38 need to offer free times: the agenda of the booking
// window (today to today + 30), the active services and who offers each.
export type OwnerBookingData = AgendaData & {
  services: OwnerService[];
  // barber id → the services they offer.
  offers: Record<string, string[]>;
};

export async function loadOwnerBookingData(
  barbershopId: string,
  now: Date,
): Promise<OwnerBookingData> {
  const window = bookingWindow(now);
  const supabase = await createSupabaseServerClient();
  const [agenda, services, offers] = await Promise.all([
    loadOwnerAgenda(barbershopId, window.from, window.until),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cop")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("barbershop_id", barbershopId),
  ]);
  if (services.error) throw services.error;
  if (offers.error) throw offers.error;

  const byBarber: Record<string, string[]> = {};
  for (const row of offers.data) {
    (byBarber[row.barber_id] ??= []).push(row.service_id);
  }
  return {
    ...agenda,
    services: services.data.map((row) => ({
      id: row.id,
      name: row.name,
      durationMinutes: row.duration_minutes,
      priceCop: row.price_cop,
    })),
    offers: byBarber,
  };
}

// D-38: customers whose name, email or phone match, as D-40 searches.
export type CustomerMatch = {
  id: string;
  name: string;
  email: string | null;
  visits: number;
};

export async function findCustomers(
  barbershopId: string,
  search: string,
): Promise<CustomerMatch[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_customers", {
    p_barbershop_id: barbershopId,
    p_search: search,
    p_limit: 5,
  });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: (row.email as string | null) ?? null,
    visits: row.visits,
  }));
}

export type OwnerWrite<T = void> =
  { ok: true; value: T } | { ok: false; error: OwnerRefusal };

async function write<T>(
  call: (
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) => PromiseLike<{
    data: T | null;
    error: { code?: string; hint?: string | null } | null;
  }>,
): Promise<OwnerWrite<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await call(supabase);
  if (error) return { ok: false, error: toOwnerRefusal(error) };
  return { ok: true, value: data as T };
}

export type ManualAppointmentRequest = {
  barberId: string;
  start: Date;
  serviceIds: string[];
  customer:
    | { id: string }
    | { name: string; email: string | null; phone: string | null };
};

export function createManualAppointment(
  barbershopId: string,
  request: ManualAppointmentRequest,
): Promise<OwnerWrite<string>> {
  const customer = request.customer;
  return write<string>((supabase) =>
    supabase.rpc("create_manual_appointment", {
      p_barbershop_id: barbershopId,
      p_barber_id: request.barberId,
      p_starts_at: request.start.toISOString(),
      p_service_ids: request.serviceIds,
      ...("id" in customer
        ? { p_customer_id: customer.id }
        : {
            p_customer_name: customer.name,
            ...(customer.email ? { p_customer_email: customer.email } : {}),
            ...(customer.phone ? { p_customer_phone: customer.phone } : {}),
          }),
    }),
  );
}

export function rescheduleOwnerAppointment(
  id: string,
  barberId: string,
  start: Date,
): Promise<OwnerWrite> {
  return write<undefined>((supabase) =>
    supabase.rpc("reschedule_appointment", {
      p_appointment_id: id,
      p_barber_id: barberId,
      p_starts_at: start.toISOString(),
    }),
  );
}

export function changeOwnerAppointmentServices(
  id: string,
  serviceIds: string[],
): Promise<OwnerWrite> {
  return write<undefined>((supabase) =>
    supabase.rpc("change_appointment_services_checked", {
      p_appointment_id: id,
      p_service_ids: serviceIds,
    }),
  );
}

export function setOwnerAppointmentStatus(
  id: string,
  status: "attended" | "no_show" | "cancelled_by_barbershop",
): Promise<OwnerWrite> {
  return write<undefined>((supabase) =>
    supabase.rpc("set_appointment_status", {
      p_appointment_id: id,
      p_status: status,
    }),
  );
}

export function createOwnerBlock(
  barbershopId: string,
  block: {
    barberId: string | null;
    start: Date;
    end: Date;
    reason: string | null;
  },
): Promise<OwnerWrite<string>> {
  return write<string>((supabase) =>
    supabase.rpc("create_time_block", {
      p_barbershop_id: barbershopId,
      // The generated types call a parameter without default non-null; the
      // function takes null for the whole barbershop.
      p_barber_id: block.barberId as string,
      p_starts_at: block.start.toISOString(),
      p_ends_at: block.end.toISOString(),
      ...(block.reason ? { p_reason: block.reason } : {}),
    }),
  );
}

export function deleteOwnerBlock(id: string): Promise<OwnerWrite> {
  return write<undefined>((supabase) =>
    supabase.rpc("delete_time_block", { p_block_id: id }),
  );
}

// The sheet of D-34 "Editar servicios": the active services the barber of
// the appointment offers.
export async function loadBarberServices(
  barbershopId: string,
  barberId: string,
): Promise<OwnerService[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barber_services")
    .select("services(id, name, duration_minutes, price_cop, active)")
    .eq("barbershop_id", barbershopId)
    .eq("barber_id", barberId);
  if (error) throw error;
  return data
    .flatMap((row) => (row.services && row.services.active ? [row.services] : []))
    .map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
      priceCop: service.price_cop,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es-CO"));
}

// D-38 from a customer's profile (D-41, "?cliente="): who is chosen. Null
// for an id that is not one, of another barbershop, or deleted.
export async function getCustomerMatch(
  barbershopId: string,
  id: string,
): Promise<CustomerMatch | null> {
  if (!isId(id)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .is("anonymized_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const visits = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId)
    .eq("customer_id", id)
    .eq("status", "attended");
  if (visits.error) throw visits.error;
  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
    visits: visits.count ?? 0,
  };
}
