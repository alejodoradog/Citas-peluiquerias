import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireLocalSupabaseUrl } from "./supabase";

// The appointments of the agenda's tests (task 4.1). A web booking goes
// through book_appointment_from_app with the server key, as the app books
// (task 3.5). The other seeds also use the server key: since task 4.2b the
// owner's session writes appointments and a barber's blocks only through the
// functions of task 4.2, which refuse past times, and the tests need them.

function serverClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY");
  return createClient(requireLocalSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function bookOnline(
  barbershopId: string,
  booking: {
    barberId: string;
    startsAt: Date;
    serviceIds: string[];
    name: string;
    email: string;
  },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await serverClient().rpc(
    "book_appointment_from_app",
    {
      p_barbershop_id: barbershopId,
      p_barber_id: booking.barberId,
      p_starts_at: booking.startsAt.toISOString(),
      p_service_ids: booking.serviceIds,
      p_customer_name: booking.name,
      p_customer_email: booking.email,
      p_manage_token_hash: createHash("sha256").update(token).digest("hex"),
    },
  );
  if (error) throw error;
  return (data as { appointment_id: string }[])[0]!.appointment_id;
}

export async function addManualAppointment(
  owner: SupabaseClient,
  barbershopId: string,
  appointment: {
    barberId: string;
    startsAt: Date;
    serviceIds: string[];
    customerName: string;
    status?: "attended" | "no_show" | "cancelled_by_barbershop";
  },
): Promise<string> {
  const { data: customer, error: customerError } = await owner
    .from("customers")
    .insert({
      barbershop_id: barbershopId,
      full_name: appointment.customerName,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;
  return seedAppointment({
    barbershopId,
    customerId: customer.id,
    barberId: appointment.barberId,
    startsAt: appointment.startsAt,
    serviceIds: appointment.serviceIds,
    status: appointment.status,
  });
}

// The owner's session is not needed any more (task 4.2b); it stays in the
// signature so the callers do not change.
export async function addBlock(
  _owner: SupabaseClient,
  barbershopId: string,
  block: { barberId: string; startsAt: Date; endsAt: Date; reason: string },
) {
  const { error } = await serverClient().from("time_blocks").insert({
    barbershop_id: barbershopId,
    barber_id: block.barberId,
    starts_at: block.startsAt.toISOString(),
    ends_at: block.endsAt.toISOString(),
    reason: block.reason,
  });
  if (error) throw error;
}

// A manual appointment of an existing customer, at any time (past ones too),
// with the server key, as create_manual_appointment would write it; then its
// status, if it is not confirmed.
export async function seedAppointment(appointment: {
  barbershopId: string;
  customerId: string;
  barberId: string;
  startsAt: Date;
  serviceIds: string[];
  status?: "confirmed" | "attended" | "no_show" | "cancelled_by_barbershop";
}): Promise<string> {
  const server = serverClient();
  const { data: id, error } = await server.rpc("create_appointment", {
    p_barbershop_id: appointment.barbershopId,
    p_customer_id: appointment.customerId,
    p_barber_id: appointment.barberId,
    p_starts_at: appointment.startsAt.toISOString(),
    p_service_ids: appointment.serviceIds,
  });
  if (error) throw error;
  if (appointment.status && appointment.status !== "confirmed") {
    const { error: statusError } = await server
      .from("appointments")
      .update({ status: appointment.status })
      .eq("id", id);
    if (statusError) throw statusError;
  }
  return id as string;
}
