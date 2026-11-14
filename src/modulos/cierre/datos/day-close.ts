import "server-only";
import {
  addDays,
  startOfBogotaDay,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CloseAppointment, CloseBarber } from "../dominio/day-close";

// "Cierre del día" (task 4.6), read with the owner's session: RLS keeps
// every row inside their own barbershops, and each query filters by the
// active one. Never cached: an appointment can be marked at any moment.

export type DayCloseData = {
  appointments: CloseAppointment[];
  barbers: CloseBarber[];
  commissionPercent: number;
};

// The appointments that start on one Bogotá day, with their lines.
export async function loadDayClose(
  barbershopId: string,
  date: BogotaDate,
): Promise<DayCloseData> {
  const supabase = await createSupabaseServerClient();
  const [appointments, barbers, shop] = await Promise.all([
    supabase
      .from("appointments")
      .select("barber_id, status, appointment_services(price_cop)")
      .eq("barbershop_id", barbershopId)
      .gte("starts_at", startOfBogotaDay(date).toISOString())
      .lt("starts_at", startOfBogotaDay(addDays(date, 1)).toISOString()),
    supabase
      .from("barbers")
      .select("id, display_name, is_owner, sort_order")
      .eq("barbershop_id", barbershopId),
    supabase
      .from("barbershops")
      .select("commission_percent")
      .eq("id", barbershopId)
      .single(),
  ]);
  if (appointments.error) throw new Error(appointments.error.message);
  if (barbers.error) throw new Error(barbers.error.message);
  if (shop.error) throw new Error(shop.error.message);

  return {
    appointments: appointments.data.map((row) => ({
      barberId: row.barber_id,
      status: row.status,
      lines: row.appointment_services.map((line) => ({
        priceCop: line.price_cop,
      })),
    })),
    barbers: barbers.data.map((row) => ({
      id: row.id,
      name: row.display_name,
      isOwner: row.is_owner,
      sortOrder: row.sort_order,
    })),
    commissionPercent: shop.data.commission_percent,
  };
}

// "Comisión de los barberos" (decision C1): one percentage for the barbershop.
export async function saveCommission(
  barbershopId: string,
  percent: number,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .update({ commission_percent: percent })
    .eq("id", barbershopId)
    .select("id");
  return !error && data.length === 1;
}
