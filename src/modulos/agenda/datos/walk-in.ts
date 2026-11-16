import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WalkInRequest, WalkInService } from "../dominio/walk-in";
import { toWalkInFailure, type WalkInFailure } from "./walk-in-errors";

// Task 7.7: the walk-in appointment ("Cita al momento"). Both entries write
// through the security definer functions of migration
// add_walk_in_appointments, which set the start (now) and check every rule
// again; nothing here sends a time.
// - The professional's (create_my_walk_in, my_services): who they are and
//   their establishment come from the session only. Nothing in the request
//   names a professional or an establishment.
// - The owner's (create_walk_in_appointment): the establishment is the
//   owner's active one, as the server knows it (requireOwner), and the
//   database checks that the professional is of it.

export type WalkInResult =
  { ok: true; appointmentId: string } | ({ ok: false } & WalkInFailure);

// The active services the professional of the session does. Empty for a
// session that is not of a professional.
export async function loadMyServices(): Promise<WalkInService[]> {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("my_services");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes,
    priceCop: row.price_cop,
  }));
}

export async function createMyWalkIn(
  request: WalkInRequest,
): Promise<WalkInResult> {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("create_my_walk_in", {
    p_service_ids: request.serviceIds,
    ...(request.customerName ? { p_customer_name: request.customerName } : {}),
  });
  if (error) return { ok: false, ...toWalkInFailure(error) };
  return { ok: true, appointmentId: data };
}

export async function createOwnerWalkIn(
  barbershopId: string,
  barberId: string,
  request: WalkInRequest,
): Promise<WalkInResult> {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("create_walk_in_appointment", {
    p_barbershop_id: barbershopId,
    p_barber_id: barberId,
    p_service_ids: request.serviceIds,
    ...(request.customerName ? { p_customer_name: request.customerName } : {}),
  });
  if (error) return { ok: false, ...toWalkInFailure(error) };
  return { ok: true, appointmentId: data };
}

export type WalkInBarber = { id: string; name: string; serviceIds: string[] };

// The owner's choices: the active professionals of the establishment, the
// active services, and which of them each one does. RLS keeps the reads
// inside the owner's establishments; the filter by the active one keeps
// them in it.
export async function loadWalkInChoices(barbershopId: string): Promise<{
  barbers: WalkInBarber[];
  services: WalkInService[];
}> {
  const supabase = await createSupabaseServerClient();
  const [barbers, services, offers] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("sort_order")
      .order("display_name"),
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
  if (barbers.error) throw barbers.error;
  if (services.error) throw services.error;
  if (offers.error) throw offers.error;
  const active = new Set(services.data.map((row) => row.id));
  return {
    barbers: barbers.data.map((row) => ({
      id: row.id,
      name: row.display_name,
      serviceIds: offers.data
        .filter(
          (offer) => offer.barber_id === row.id && active.has(offer.service_id),
        )
        .map((offer) => offer.service_id),
    })),
    services: services.data.map((row) => ({
      id: row.id,
      name: row.name,
      durationMinutes: row.duration_minutes,
      priceCop: row.price_cop,
    })),
  };
}
