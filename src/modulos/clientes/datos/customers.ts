import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isId } from "@/modulos/barberias/dominio/service";
import {
  databaseFilter,
  LIST_LIMIT,
  type AppointmentStatus,
  type CustomerFilter,
  type HistoryEntry,
} from "../dominio/customers";

// Task 4.3. Everything runs with the owner's session: RLS keeps each query
// to the owner's barbershops, and the filter by barbershop keeps another
// sede of the same owner out. A deleted (anonymized) customer is not listed
// and has no profile.

export type CustomerListRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  visits: number;
  noShows: number;
  lastVisitAt: Date | null;
  nextAppointmentAt: Date | null;
};

const date = (value: string | null): Date | null =>
  value ? new Date(value) : null;

// D-40: up to LIST_LIMIT rows, and whether there were more.
export async function listCustomers(
  barbershopId: string,
  { search, filter }: { search: string; filter: CustomerFilter },
): Promise<{ rows: CustomerListRow[]; more: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_customers", {
    p_barbershop_id: barbershopId,
    p_search: search,
    p_filter: databaseFilter(filter),
    p_limit: LIST_LIMIT + 1,
  });
  if (error) throw error;
  // The generated types call every column of a returned table non-null.
  const rows = data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    visits: row.visits,
    noShows: row.no_shows,
    lastVisitAt: date(row.last_visit_at as string | null),
    nextAppointmentAt: date(row.next_appointment_at as string | null),
  }));
  return { rows: rows.slice(0, LIST_LIMIT), more: rows.length > LIST_LIMIT };
}

// "128 clientes": every customer of the barbershop who was not deleted.
export async function countCustomers(barbershopId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershopId)
    .is("anonymized_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type CustomerProfile = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  history: HistoryEntry[];
};

// D-41: the customer and every appointment of theirs, with the services in
// their order and the barber. Null for an id that is not one, a customer of
// another barbershop, or a deleted one.
export async function getCustomerProfile(
  barbershopId: string,
  id: string,
): Promise<CustomerProfile | null> {
  if (!isId(id)) return null;
  const supabase = await createSupabaseServerClient();
  const [customer, appointments] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, email, phone, notes, created_at")
      .eq("barbershop_id", barbershopId)
      .eq("id", id)
      .is("anonymized_at", null)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, price_cop, barbers(display_name), appointment_services(position, services(name))",
      )
      .eq("barbershop_id", barbershopId)
      .eq("customer_id", id)
      .order("starts_at", { ascending: false }),
  ]);
  if (customer.error) throw customer.error;
  if (appointments.error) throw appointments.error;
  if (!customer.data) return null;

  return {
    id: customer.data.id,
    fullName: customer.data.full_name,
    email: customer.data.email,
    phone: customer.data.phone,
    notes: customer.data.notes,
    createdAt: new Date(customer.data.created_at),
    history: appointments.data.map((row) => ({
      id: row.id,
      startsAt: new Date(row.starts_at),
      status: row.status as AppointmentStatus,
      priceCop: row.price_cop,
      barber: row.barbers?.display_name ?? "",
      services: [...row.appointment_services]
        .sort((a, b) => a.position - b.position)
        .map((line) => line.services?.name ?? ""),
    })),
  };
}

// False when nothing was written: RLS hid the row, it was deleted
// meanwhile, or the database refused the notes.
export async function updateCustomerNotes(
  barbershopId: string,
  id: string,
  notes: string | null,
): Promise<boolean> {
  if (!isId(id)) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ notes })
    .eq("barbershop_id", barbershopId)
    .eq("id", id)
    .is("anonymized_at", null)
    .select("id");
  if (error) return false;
  return data.length === 1;
}

export type DeleteCustomerError =
  "has_upcoming_appointments" | "customer_not_found" | "unknown";

type DatabaseError = { code?: string; hint?: string | null };

// The hints of anonymize_customer (migration add_customer_anonymization).
export function deleteCustomerError(error: DatabaseError): DeleteCustomerError {
  if (error.hint === "has_upcoming_appointments") {
    return "has_upcoming_appointments";
  }
  if (
    error.hint === "customer_not_found" ||
    error.hint === "customer_anonymized"
  ) {
    return "customer_not_found";
  }
  return "unknown";
}

// D-42 "Borrar cliente": anonymizes the customer, or deletes the row when no
// appointment points at it.
export async function anonymizeCustomer(
  barbershopId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; code: DeleteCustomerError }> {
  if (!isId(id)) return { ok: false, code: "customer_not_found" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("anonymize_customer", {
    p_barbershop_id: barbershopId,
    p_customer_id: id,
  });
  if (error) return { ok: false, code: deleteCustomerError(error) };
  return { ok: true };
}
