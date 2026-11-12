import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireLocalSupabaseUrl } from "./supabase";

// The appointments of the agenda's tests (task 4.1), written the way the app
// writes them: a web booking through book_appointment_from_app with the
// server key (since task 3.5 only the server books), a manual one through
// create_appointment with the owner's session.

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
  const { data: id, error } = await owner.rpc("create_appointment", {
    p_barbershop_id: barbershopId,
    p_customer_id: customer.id,
    p_barber_id: appointment.barberId,
    p_starts_at: appointment.startsAt.toISOString(),
    p_service_ids: appointment.serviceIds,
  });
  if (error) throw error;
  if (appointment.status) {
    const { error: statusError } = await owner
      .from("appointments")
      .update({ status: appointment.status })
      .eq("id", id);
    if (statusError) throw statusError;
  }
  return id as string;
}

export async function addBlock(
  owner: SupabaseClient,
  barbershopId: string,
  block: { barberId: string; startsAt: Date; endsAt: Date; reason: string },
) {
  const { error } = await owner.from("time_blocks").insert({
    barbershop_id: barbershopId,
    barber_id: block.barberId,
    starts_at: block.startsAt.toISOString(),
    ends_at: block.endsAt.toISOString(),
    reason: block.reason,
  });
  if (error) throw error;
}
