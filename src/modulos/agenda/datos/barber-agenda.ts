import "server-only";
import { z } from "zod";
import { addDays, type BogotaDate } from "@/lib/fechas/fechas";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashLinkToken, isLinkToken } from "@/lib/tokens/link-token";
import type { BarberAgendaData } from "../dominio/barber-agenda";
import { toBarberRefusal, type BarberRefusal } from "./barber-errors";

// "Mi agenda" of a barber, by one of two entries:
// - the private link (task 4.4), always as anon: the link's token is the
//   whole credential, and only its hash goes to the database (migration
//   add_barber_agenda). Anon, so the history records the barber and not an
//   owner who happens to be signed in on the same phone;
// - the professional's own session (task 7.6b): the my_* functions
//   (migration add_professional_accounts) find the professional from
//   auth.uid(). Nothing here sends who the professional is, nor their
//   barbershop: the database alone decides it.
// Never cached: a booking can arrive at any moment.

// Who asks: the link's token, or the session in the request's cookies.
export type BarberSource =
  { kind: "link"; token: string } | { kind: "session" };

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

// A link that is not even well formed never reaches the database.
function badLink(source: BarberSource): boolean {
  return source.kind === "link" && !isLinkToken(source.token);
}

// The days [from, until] (at most 7), or null when the source reaches no
// agenda: a link deactivated, replaced, made up, or of a deleted barbershop
// (B-05), or a session that is not (or no longer) of a professional.
export async function loadBarberAgenda(
  source: BarberSource,
  from: BogotaDate,
  until: BogotaDate,
): Promise<BarberAgendaData | null> {
  if (badLink(source)) return null;
  const { data, error } =
    source.kind === "link"
      ? await createSupabasePublicClient().rpc("barber_agenda", {
          p_token_hash: hashLinkToken(source.token),
          p_from: from,
          p_to: until,
        })
      : await (
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
  source: "web" | "manual";
  createdAt: Date;
  customerName: string;
  services: { name: string; minutes: number }[];
  visits: number;
  noShows: number;
  writable: boolean;
  // Decision 0010, point 6: the customer's phone, only by the session (the
  // link never brings it) and only inside the days the agenda opens.
  customerPhone: string | null;
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: (typeof STATUSES)[number];
  source: "web" | "manual";
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
  source: BarberSource,
  appointmentId: string,
): Promise<AppointmentRow | undefined> {
  if (source.kind === "link") {
    const { data, error } = await createSupabasePublicClient().rpc(
      "barber_appointment",
      {
        p_token_hash: hashLinkToken(source.token),
        p_appointment_id: appointmentId,
      },
    );
    if (error) throw new Error(error.message);
    const row = data?.[0];
    return row ? { ...row, customer_phone: null } : undefined;
  }
  const { data, error } = await (
    await createSupabaseServerClient()
  ).rpc("my_appointment", { p_appointment_id: appointmentId });
  if (error) throw new Error(error.message);
  return data?.[0];
}

// B-03: one appointment of this barber, or null (another barber's, another
// barbershop's, a link that does not work or a session that is not of a
// professional).
export async function loadBarberAppointment(
  source: BarberSource,
  appointmentId: string,
): Promise<BarberAppointmentDetail | null> {
  if (badLink(source) || !z.uuid().safeParse(appointmentId).success) {
    return null;
  }
  const row = await appointmentRow(source, appointmentId);
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

const LINK_INVALID: BarberResult = { ok: false, error: "link_invalid" };

export async function markAppointmentByBarber(
  source: BarberSource,
  appointmentId: string,
  status: "attended" | "no_show",
): Promise<BarberResult> {
  if (badLink(source)) return LINK_INVALID;
  const { error } =
    source.kind === "link"
      ? await createSupabasePublicClient().rpc("mark_appointment_by_barber", {
          p_token_hash: hashLinkToken(source.token),
          p_appointment_id: appointmentId,
          p_status: status,
        })
      : await (
          await createSupabaseServerClient()
        ).rpc("mark_my_appointment", {
          p_appointment_id: appointmentId,
          p_status: status,
        });
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function createTimeBlockByBarber(
  source: BarberSource,
  block: { start: Date; end: Date; reason: string | null },
): Promise<BarberResult> {
  if (badLink(source)) return LINK_INVALID;
  const range = {
    p_starts_at: block.start.toISOString(),
    p_ends_at: block.end.toISOString(),
    ...(block.reason ? { p_reason: block.reason } : {}),
  };
  const { error } =
    source.kind === "link"
      ? await createSupabasePublicClient().rpc("create_time_block_by_barber", {
          p_token_hash: hashLinkToken(source.token),
          ...range,
        })
      : await (
          await createSupabaseServerClient()
        ).rpc("create_my_time_block", range);
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

export async function deleteTimeBlockByBarber(
  source: BarberSource,
  blockId: string,
): Promise<BarberResult> {
  if (badLink(source)) return LINK_INVALID;
  const { error } =
    source.kind === "link"
      ? await createSupabasePublicClient().rpc("delete_time_block_by_barber", {
          p_token_hash: hashLinkToken(source.token),
          p_block_id: blockId,
        })
      : await (
          await createSupabaseServerClient()
        ).rpc("delete_my_time_block", { p_block_id: blockId });
  return error ? { ok: false, error: toBarberRefusal(error) } : { ok: true };
}

// The days [from, until] when they are more than the 7 the function gives at
// once: the 31 of the "Bloquear horas" picker (task 7.4), asked for a week at
// a time and put together. Null as loadBarberAgenda.
export async function loadBarberAgendaSpan(
  source: BarberSource,
  from: BogotaDate,
  until: BogotaDate,
): Promise<BarberAgendaData | null> {
  const starts: BogotaDate[] = [];
  for (let day = from; day <= until; day = addDays(day, 7)) starts.push(day);
  const weeks = await Promise.all(
    starts.map((start) => {
      const end = addDays(start, 6);
      return loadBarberAgenda(source, start, end < until ? end : until);
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
