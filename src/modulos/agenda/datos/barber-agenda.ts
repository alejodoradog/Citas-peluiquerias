import "server-only";
import { z } from "zod";
import { addDays, type BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BarberAgendaData } from "../dominio/barber-agenda";
import type { AppointmentSource } from "../dominio/owner-agenda";
import { toBarberRefusal, type BarberRefusal } from "./barber-errors";

// "Mi agenda" of a professional (task 4.4), by their own session (task 7.6b;
// the private link went with task 7.6c): the my_* functions (migration
// add_professional_accounts) find the professional from auth.uid(). Nothing
// here sends who the professional is, nor their barbershop: the database
// alone decides it. Never cached: a booking can arrive at any moment.

const STATUSES = [
  "confirmed",
  "attended",
  "no_show",
  "cancelled_by_customer",
  "cancelled_by_barbershop",
] as const;

const shift = z.object({
  weekday: z.number().int().min(0).max(6),
  start: z.string(),
  end: z.string(),
});

const agendaSchema = z.object({
  barber: z.object({ id: z.string(), name: z.string(), active: z.boolean() }),
  barbershop: z.object({ name: z.string(), writable: z.boolean() }),
  schedule: z.object({
    usesBarbershopHours: z.boolean(),
    shifts: z.array(shift),
  }),
  shopHours: z.array(shift),
  holidayOpenings: z.array(z.string()),
  appointments: z.array(
    z.object({
      id: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.enum(STATUSES),
      source: z.enum(["web", "manual", "walk_in"]),
      createdAt: z.string(),
      customerName: z.string(),
      services: z.array(z.string()),
    }),
  ),
  blocks: z.array(
    z.object({
      id: z.string(),
      own: z.boolean(),
      startsAt: z.string(),
      endsAt: z.string(),
      reason: z.string().nullable(),
    }),
  ),
});

// The days [from, until] (at most 7), or null when the session is not (or
// no longer) of a professional, or their barbershop was deleted.
export async function loadBarberAgenda(
  from: BogotaDate,
  until: BogotaDate,
): Promise<BarberAgendaData | null> {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("my_agenda", { p_from: from, p_to: until });
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const agenda = agendaSchema.parse(data);
  return {
    barber: agenda.barber,
    barbershop: agenda.barbershop,
    schedule: agenda.schedule,
    shopHours: agenda.shopHours,
    holidayOpenings: agenda.holidayOpenings,
    appointments: agenda.appointments.map((row) => ({
      id: row.id,
      start: new Date(row.startsAt),
      end: new Date(row.endsAt),
      status: row.status,
      source: row.source,
      createdAt: new Date(row.createdAt),
      customerName: row.customerName,
      serviceNames: row.services,
    })),
    blocks: agenda.blocks.map((row) => ({
      id: row.id,
      own: row.own,
      start: new Date(row.startsAt),
      end: new Date(row.endsAt),
      reason: row.reason,
    })),
  };
}

export type BarberAppointmentDetail = {
  id: string;
  start: Date;
  end: Date;
  status: (typeof STATUSES)[number];
  source: AppointmentSource;
  createdAt: Date;
  customerName: string;
  services: { name: string; minutes: number }[];
  visits: number;
  noShows: number;
  writable: boolean;
  // Decision 0010, point 6: the customer's phone, only of their own
  // appointments and only inside the days the agenda opens.
  customerPhone: string | null;
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: (typeof STATUSES)[number];
  source: AppointmentSource;
  created_at: string;
  customer_name: string;
  customer_phone: string | null;
  service_names: string[];
  service_minutes: number[];
  visits: number;
  no_shows: number;
  writable: boolean;
};

async function appointmentRow(
  appointmentId: string,
): Promise<AppointmentRow | undefined> {
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("my_appointment", { p_appointment_id: appointmentId });
  if (error) throw new Error(error.message);
  return data?.[0];
}

// B-03: one appointment of this barber, or null (another barber's, another
// barbershop's, or a session that is not of a professional).
export async function loadBarberAppointment(
  appointmentId: string,
): Promise<BarberAppointmentDetail | null> {
  if (!z.uuid().safeParse(appointmentId).success) return null;
  const row = await appointmentRow(appointmentId);
  if (!row) return null;
  return {
    id: row.id,
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at),
    customerName: row.customer_name,
    services: row.service_names.map((name, index) => ({
      name,
      minutes: row.service_minutes[index] ?? 0,
    })),
    visits: row.visits,
    noShows: row.no_shows,
    writable: row.writable,
    customerPhone: row.customer_phone,
  };
}

export type BarberResult = { ok: true } | { ok: false; error: BarberRefusal };

export async function markAppointmentByBarber(
  appointmentId: string,
  status: "attended" | "no_show",
): Promise<BarberResult> {
  const { error } = await (
    await createSupabaseServerClient()
  ).rpc("mark_my_appointment", {
    p_appointment_id: appointmentId,
    p_status: status,
  });
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function createTimeBlockByBarber(block: {
  start: Date;
  end: Date;
  reason: string | null;
}): Promise<BarberResult> {
  const { error } = await (
    await createSupabaseServerClient()
  ).rpc("create_my_time_block", {
    p_starts_at: block.start.toISOString(),
    p_ends_at: block.end.toISOString(),
    ...(block.reason ? { p_reason: block.reason } : {}),
  });
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function deleteTimeBlockByBarber(
  blockId: string,
): Promise<BarberResult> {
  const { error } = await (
    await createSupabaseServerClient()
  ).rpc("delete_my_time_block", { p_block_id: blockId });
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

// The days [from, until] when they are more than the 7 the function gives at
// once: the 31 of the "Bloquear horas" picker (task 7.4), asked for a week at
// a time and put together. Null as loadBarberAgenda.
export async function loadBarberAgendaSpan(
  from: BogotaDate,
  until: BogotaDate,
): Promise<BarberAgendaData | null> {
  const starts: BogotaDate[] = [];
  for (let day = from; day <= until; day = addDays(day, 7)) starts.push(day);
  const weeks = await Promise.all(
    starts.map((start) => {
      const end = addDays(start, 6);
      return loadBarberAgenda(start, end < until ? end : until);
    }),
  );
  const first = weeks[0];
  if (!first || weeks.some((week) => week === null)) return null;
  const all = weeks as BarberAgendaData[];
  // A block or an appointment that crosses midnight comes in two weeks.
  const byId = <Item extends { id: string }>(items: Item[]) => [
    ...new Map(items.map((item) => [item.id, item])).values(),
  ];
  return {
    ...first,
    holidayOpenings: [...new Set(all.flatMap((week) => week.holidayOpenings))],
    appointments: byId(all.flatMap((week) => [...week.appointments])),
    blocks: byId(all.flatMap((week) => [...week.blocks])),
  };
}
