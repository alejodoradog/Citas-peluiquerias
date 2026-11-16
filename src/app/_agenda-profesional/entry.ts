import {
  barberAgendaHref,
  myAgendaHref,
  routes,
  type BarberAgendaParams,
} from "@/lib/routes";

// The two entries to "Mi agenda" (B-01 to B-04): the private link of task
// 4.4 (/b/<token>, until task 7.6c removes it) and the professional's own
// session of task 7.6b (/mi-agenda). The screens are the same; this says
// where their links go. The session entry carries nothing: who the
// professional is comes from the cookies, on the server, every time.
export type AgendaEntry = { kind: "link"; token: string } | { kind: "session" };

export const SESSION_ENTRY: AgendaEntry = { kind: "session" };

export function agendaHref(
  entry: AgendaEntry,
  query: BarberAgendaParams = {},
): string {
  return entry.kind === "link"
    ? barberAgendaHref(entry.token, query)
    : myAgendaHref(query);
}

export function appointmentHref(entry: AgendaEntry, id: string): string {
  return entry.kind === "link"
    ? routes.barberAppointment(entry.token, id)
    : routes.myAppointment(id);
}

export function blockHref(entry: AgendaEntry): string {
  return entry.kind === "link"
    ? routes.barberBlock(entry.token)
    : routes.myBlock;
}
