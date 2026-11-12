import "server-only";
import {
  addDays,
  startOfBogotaDay,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHolidayOpenings } from "@/modulos/barberias/datos/holidays";
import { getBarbershopHours } from "@/modulos/barberias/datos/setup";
import type {
  AgendaAppointment,
  AgendaBarber,
  AgendaBlock,
  AgendaData,
} from "../dominio/owner-agenda";

// The owner's agenda (task 4.1), read with the owner's session: RLS
// (member_* and owner_read policies) keeps every row inside their own
// barbershops, and each query also filters by the active one, so a second
// sede of the same owner stays out. No function of the database is needed:
// the owner already reads appointments, their lines, customers and blocks.
// Never cached: a booking can arrive at any moment.

const TAKES_TIME = ["confirmed", "attended", "no_show"] as const;

// The days [from, until], both included, in Bogotá.
export async function loadOwnerAgenda(
  barbershopId: string,
  from: BogotaDate,
  until: BogotaDate,
): Promise<AgendaData> {
  const supabase = await createSupabaseServerClient();
  const start = startOfBogotaDay(from).toISOString();
  const end = startOfBogotaDay(addDays(until, 1)).toISOString();

  const [barbers, schedules, appointments, blocks, shopHours, openings] =
    await Promise.all([
      supabase
        .from("barbers")
        .select("id, display_name, sort_order, active, uses_barbershop_hours")
        .eq("barbershop_id", barbershopId)
        .order("sort_order")
        .order("display_name"),
      supabase
        .from("barber_schedules")
        .select("barber_id, weekday, start_time, end_time")
        .eq("barbershop_id", barbershopId),
      supabase
        .from("appointments")
        .select(
          "id, barber_id, starts_at, ends_at, status, source, created_at, customers(full_name), appointment_services(position, services(name))",
        )
        .eq("barbershop_id", barbershopId)
        .in("status", [...TAKES_TIME])
        .lt("starts_at", end)
        .gt("ends_at", start)
        .order("starts_at"),
      supabase
        .from("time_blocks")
        .select("id, barber_id, starts_at, ends_at, reason")
        .eq("barbershop_id", barbershopId)
        .lt("starts_at", end)
        .gt("ends_at", start)
        .order("starts_at"),
      getBarbershopHours(barbershopId),
      getHolidayOpenings(barbershopId, { from, until }),
    ]);
  if (barbers.error) throw barbers.error;
  if (schedules.error) throw schedules.error;
  if (appointments.error) throw appointments.error;
  if (blocks.error) throw blocks.error;

  return {
    barbers: barbers.data.map((row): AgendaBarber => ({
      id: row.id,
      name: row.display_name,
      sortOrder: row.sort_order,
      active: row.active,
      usesBarbershopHours: row.uses_barbershop_hours,
      shifts: schedules.data
        .filter((shift) => shift.barber_id === row.id)
        .map((shift) => ({
          weekday: shift.weekday,
          start: shift.start_time.slice(0, 5),
          end: shift.end_time.slice(0, 5),
        })),
    })),
    shopHours,
    holidayOpenings: openings,
    appointments: appointments.data.map((row): AgendaAppointment => ({
      id: row.id,
      barberId: row.barber_id,
      start: new Date(row.starts_at),
      end: new Date(row.ends_at),
      status: row.status,
      source: row.source,
      createdAt: new Date(row.created_at),
      customerName: row.customers?.full_name ?? "",
      serviceNames: [...row.appointment_services]
        .sort((a, b) => a.position - b.position)
        .map((line) => line.services?.name ?? "")
        .filter((name) => name !== ""),
    })),
    blocks: blocks.data.map((row): AgendaBlock => ({
      id: row.id,
      barberId: row.barber_id,
      start: new Date(row.starts_at),
      end: new Date(row.ends_at),
      reason: row.reason,
    })),
  };
}

// Whether the barbershop ever had an appointment, cancelled ones included:
// until the first one, an empty day shows how to get it (D-33, decision A8).
export async function hasAnyAppointment(
  barbershopId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("barbershop_id", barbershopId)
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}
