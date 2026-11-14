import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  hashLinkToken,
  isLinkToken,
  newLinkToken,
} from "@/lib/tokens/link-token";

// "Mis citas" (C-19 to C-21, migration add_my_appointments). Asking for the
// email goes through the app's server (after Turnstile, with the IP limit);
// the list is read with the link's token as anon: the database receives the
// token and hashes it itself, so what it keeps is never a working link.

export type MyAppointmentsRequest =
  { ok: true } | { ok: false; error: "too_many_from_ip" | "unknown" };

export async function requestMyAppointments(request: {
  barbershopId: string;
  email: string;
  clientIpHash: string | null;
}): Promise<MyAppointmentsRequest> {
  const { error } = await createSupabaseAdminClient().rpc(
    "request_my_appointments",
    {
      p_barbershop_id: request.barbershopId,
      p_email: request.email,
      ...(request.clientIpHash
        ? { p_client_ip_hash: request.clientIpHash }
        : {}),
    },
  );
  if (!error) return { ok: true };
  return {
    ok: false,
    error: error.hint === "too_many_from_ip" ? "too_many_from_ip" : "unknown",
  };
}

export type MyAppointment = {
  id: string;
  start: Date;
  end: Date;
  priceCop: number;
  barberName: string;
  serviceNames: string[];
};

export type MyAppointments = {
  slug: string;
  barbershopName: string;
  customerFirstName: string;
  appointments: MyAppointment[];
};

// Null for a link that does not work: unknown, older than 24 hours, of a
// deleted customer or barbershop. Never cached.
export async function loadMyAppointments(
  token: string,
): Promise<MyAppointments | null> {
  if (!isLinkToken(token)) return null;
  const { data, error } = await createSupabasePublicClient().rpc(
    "my_appointments",
    { p_token: token },
  );
  if (error) throw new Error(error.message);
  const first = data?.[0];
  if (!first) return null;
  return {
    slug: first.barbershop_slug,
    barbershopName: first.barbershop_name,
    customerFirstName: first.customer_first_name,
    appointments: data
      .filter((row) => row.appointment_id !== null)
      .map((row) => ({
        id: row.appointment_id,
        start: new Date(row.starts_at),
        end: new Date(row.ends_at),
        priceCop: row.price_cop,
        barberName: row.barber_name,
        serviceNames: row.service_names,
      })),
  };
}

// The link of one appointment of the list (/c/<token>, task 3.4), made when
// the customer taps it, or null.
export async function linkOfMyAppointment(
  listToken: string,
  appointmentId: string,
): Promise<string | null> {
  if (!isLinkToken(listToken)) return null;
  const token = newLinkToken();
  const { error } = await createSupabasePublicClient().rpc(
    "issue_my_appointment_link",
    {
      p_customer_token: listToken,
      p_appointment_id: appointmentId,
      p_token_hash: hashLinkToken(token),
    },
  );
  return error ? null : token;
}
