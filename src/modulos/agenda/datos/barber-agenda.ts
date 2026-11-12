import "server-only";
import { z } from "zod";
import type { BogotaDate } from "@/lib/fechas/fechas";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { hashLinkToken, isLinkToken } from "@/lib/tokens/link-token";
import type { BarberAgendaData } from "../dominio/barber-agenda";
import { toBarberRefusal, type BarberRefusal } from "./barber-errors";

// "Mi agenda" of a barber (task 4.4), always as anon: the link's token is
// the whole credential, and only its hash goes to the database (migration
// add_barber_agenda). Anon, so the history records the barber and not an
// owner who happens to be signed in on the same phone. Never cached: a
// booking can arrive at any moment.

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
      source: z.enum(["web", "manual"]),
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

// The days [from, until] (at most 7), or null for a link that does not work
// (B-05): deactivated, replaced, made up, or of a deleted barbershop.
export async function loadBarberAgenda(
  token: string,
  from: BogotaDate,
  until: BogotaDate,
): Promise<BarberAgendaData | null> {
  if (!isLinkToken(token)) return null;
  const { data, error } = await createSupabasePublicClient().rpc(
    "barber_agenda",
    { p_token_hash: hashLinkToken(token), p_from: from, p_to: until },
  );
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
  source: "web" | "manual";
  createdAt: Date;
  customerName: string;
  services: { name: string; minutes: number }[];
  visits: number;
  noShows: number;
  writable: boolean;
};

// B-03: one appointment of this barber, or null (another barber's, another
// barbershop's, or a link that does not work).
export async function loadBarberAppointment(
  token: string,
  appointmentId: string,
): Promise<BarberAppointmentDetail | null> {
  if (!isLinkToken(token) || !z.uuid().safeParse(appointmentId).success) {
    return null;
  }
  const { data, error } = await createSupabasePublicClient().rpc(
    "barber_appointment",
    { p_token_hash: hashLinkToken(token), p_appointment_id: appointmentId },
  );
  if (error) throw new Error(error.message);
  const row = data?.[0];
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
  };
}

export type BarberResult = { ok: true } | { ok: false; error: BarberRefusal };

export async function markAppointmentByBarber(
  token: string,
  appointmentId: string,
  status: "attended" | "no_show",
): Promise<BarberResult> {
  if (!isLinkToken(token)) return { ok: false, error: "link_invalid" };
  const { error } = await createSupabasePublicClient().rpc(
    "mark_appointment_by_barber",
    {
      p_token_hash: hashLinkToken(token),
      p_appointment_id: appointmentId,
      p_status: status,
    },
  );
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function createTimeBlockByBarber(
  token: string,
  block: { start: Date; end: Date; reason: string | null },
): Promise<BarberResult> {
  if (!isLinkToken(token)) return { ok: false, error: "link_invalid" };
  const { error } = await createSupabasePublicClient().rpc(
    "create_time_block_by_barber",
    {
      p_token_hash: hashLinkToken(token),
      p_starts_at: block.start.toISOString(),
      p_ends_at: block.end.toISOString(),
      ...(block.reason ? { p_reason: block.reason } : {}),
    },
  );
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function deleteTimeBlockByBarber(
  token: string,
  blockId: string,
): Promise<BarberResult> {
  if (!isLinkToken(token)) return { ok: false, error: "link_invalid" };
  const { error } = await createSupabasePublicClient().rpc(
    "delete_time_block_by_barber",
    { p_token_hash: hashLinkToken(token), p_block_id: blockId },
  );
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}
