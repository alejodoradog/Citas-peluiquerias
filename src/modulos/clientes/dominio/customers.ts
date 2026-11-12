import { z } from "zod";
import { toBogotaDate } from "@/lib/fechas/fechas";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

// Customers of a barbershop (task 4.3; spec, "Inasistencias" and data
// model): visits and no-shows are counted from the appointments, never
// stored. The database does the same count for the list (list_customers).

// Spec, "Inasistencias": with 2 or more the profile shows an alert and the
// barbershop decides whether to ask for a deposit.
export const NO_SHOW_ALERT_FROM = 2;

// "Nuevos" (K6 of task 4.3, provisional): created in the last 30 days, as
// list_customers counts them.
export const NEW_CUSTOMER_DAYS = 30;

// The list shows this many at most; the search finds the others.
export const LIST_LIMIT = 100;

// Longer searches are cut: no name, email or phone is that long.
export const MAX_SEARCH_LENGTH = 100;

// customers.notes, as its check (≤ 1000 characters).
export const MAX_NOTES_LENGTH = 1000;

// The filters of D-40, as the URL names them (?filtro=inasistencias).
export const CUSTOMER_FILTERS = ["todos", "inasistencias", "nuevos"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];

export const SEARCH_PARAM = "q";
export const FILTER_PARAM = "filtro";
// The query D-40 reads after "Borrar cliente", to say it was done.
export const DELETED_PARAM = "borrado";

// The filter as list_customers takes it.
export function databaseFilter(
  filter: CustomerFilter,
): "all" | "no_shows" | "new" {
  switch (filter) {
    case "inasistencias":
      return "no_shows";
    case "nuevos":
      return "new";
    case "todos":
      return "all";
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// The search and the filter of the URL. Anything unknown is "Todos".
export function readCustomerListParams(params: SearchParams): {
  search: string;
  filter: CustomerFilter;
} {
  const search = first(params[SEARCH_PARAM]).trim().slice(0, MAX_SEARCH_LENGTH);
  const filter = first(params[FILTER_PARAM]);
  return {
    search,
    filter: (CUSTOMER_FILTERS as readonly string[]).includes(filter)
      ? (filter as CustomerFilter)
      : "todos",
  };
}

// The list with a search and a filter; the defaults stay out of the URL.
export function customerListHref(
  base: string,
  { search, filter }: { search: string; filter: CustomerFilter },
): string {
  const query = new URLSearchParams();
  if (search) query.set(SEARCH_PARAM, search);
  if (filter !== "todos") query.set(FILTER_PARAM, filter);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

export function showsNoShowAlert(noShows: number): boolean {
  return noShows >= NO_SHOW_ALERT_FROM;
}

// What the second line of a row of D-40 says after the visits, in this
// order: the next appointment ("próxima: hoy 4:00 p. m."), that there is no
// email to write to ("cita manual, sin correo"), the last visit ("última:
// hoy"), or nothing.
export type ListActivity =
  | { kind: "next"; at: Date }
  | { kind: "noEmail" }
  | { kind: "last"; at: Date }
  | { kind: "none" };

export function listActivity(customer: {
  email: string | null;
  lastVisitAt: Date | null;
  nextAppointmentAt: Date | null;
}): ListActivity {
  if (customer.nextAppointmentAt) {
    return { kind: "next", at: customer.nextAppointmentAt };
  }
  if (!customer.email) return { kind: "noEmail" };
  if (customer.lastVisitAt) return { kind: "last", at: customer.lastVisitAt };
  return { kind: "none" };
}

export type AppointmentStatus =
  | "confirmed"
  | "attended"
  | "no_show"
  | "cancelled_by_customer"
  | "cancelled_by_barbershop";

export type HistoryEntry = {
  id: string;
  startsAt: Date;
  status: AppointmentStatus;
  priceCop: number;
  services: string[];
  barber: string;
};

// The three numbers of D-41 and the days of the alert:
// - visits: attended appointments;
// - noShows: "no asistió";
// - totalSpentCop: what the attended ones cost, in whole pesos (K7 of task
//   4.3: a no-show or a cancellation is not money received);
// - noShowDays: when they did not come, the latest first.
export function summarizeHistory(history: readonly HistoryEntry[]): {
  visits: number;
  noShows: number;
  totalSpentCop: number;
  noShowDays: Date[];
} {
  const attended = history.filter((entry) => entry.status === "attended");
  const missed = history
    .filter((entry) => entry.status === "no_show")
    .map((entry) => entry.startsAt)
    .sort((a, b) => b.getTime() - a.getTime());
  return {
    visits: attended.length,
    noShows: missed.length,
    totalSpentCop: attended.reduce((sum, entry) => sum + entry.priceCop, 0),
    noShowDays: missed,
  };
}

// The history of D-41, the latest first (an appointment to come on top).
export function sortHistory(history: readonly HistoryEntry[]): HistoryEntry[] {
  return [...history].sort(
    (a, b) =>
      b.startsAt.getTime() - a.startsAt.getTime() || (a.id < b.id ? -1 : 1),
  );
}

// A day as D-40 and D-41 write it, in Bogotá: today, or the day and the
// month, with the year only when it is not this year's ("24 oct",
// "3 dic 2025"). month is 0-11.
export type DayParts =
  | { today: true }
  | { today: false; day: number; month: number; year: number | null };

export function dayParts(instant: Date, now: Date): DayParts {
  const date = toBogotaDate(instant);
  const today = toBogotaDate(now);
  if (date === today) return { today: true };
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return {
    today: false,
    day,
    month: month - 1,
    year: date.slice(0, 4) === today.slice(0, 4) ? null : year,
  };
}

// "Cliente desde agosto 2026": the month the customer first booked, in
// Bogotá. month is 0-11.
export function sinceParts(createdAt: Date): { month: number; year: number } {
  const [year, month] = toBogotaDate(createdAt).split("-").map(Number) as [
    number,
    number,
  ];
  return { month: month - 1, year };
}

// "301 222 3344": a stored Colombian mobile (+573012223344) as people read
// it. Any other number stays as it is.
export function displayPhone(phone: string): string {
  const match = /^\+57(3\d{2})(\d{3})(\d{4})$/.exec(phone);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : phone;
}

export type NotesErrorCode = "notes_too_long";

const notesSchema = z.object({
  notes: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= MAX_NOTES_LENGTH, {
      message: "notes_too_long",
    })
    .transform((value) => (value === "" ? null : value)),
});

// The notes of D-41: trimmed, empty is none.
export function parseCustomerNotes(input: {
  notes: string;
}): ParseResult<{ notes: string | null }, NotesErrorCode> {
  return parseWith(notesSchema, input);
}
