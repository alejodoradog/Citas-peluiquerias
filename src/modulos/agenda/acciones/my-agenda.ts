"use server";

import { myAgendaHref, routes } from "@/lib/routes";
import {
  createBlockFor,
  markFor,
  removeBlockFor,
  type AgendaPaths,
  type BlockState,
} from "./barber-core";

// "Mi agenda" of a professional with their own account (task 7.6b). Who
// asks is the session in the request's cookies, and nothing else: the form
// carries no token, no barber and no barbershop, and the my_* functions
// find the professional from auth.uid() (migration add_professional_accounts).
// A session that is not of a professional gets not_professional and goes
// to /mi-agenda, whose guard sends it home. The rules are those of
// ./barber-core.ts.

const SESSION = { kind: "session" as const };
const PATHS: AgendaPaths = {
  agenda: (query) => myAgendaHref(query),
  appointment: (id) => routes.myAppointment(id),
};

export async function markMyAppointment(formData: FormData): Promise<void> {
  await markFor(SESSION, PATHS, formData);
}

export async function removeMyBlock(formData: FormData): Promise<void> {
  await removeBlockFor(SESSION, PATHS, formData);
}

export async function createMyBlock(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  return createBlockFor(SESSION, PATHS, formData);
}
