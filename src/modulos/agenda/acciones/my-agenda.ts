"use server";

import { myAgendaHref, routes } from "@/lib/routes";
import { requireProfessional } from "@/modulos/cuentas/guards";
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
// Each action first passes the same guard as the pages (requireProfessional:
// a professional who accepted the terms; anyone else goes home), and the
// database checks it again (private.barber_by_session needs the terms too).
// The rules are those of ./barber-core.ts.

const SESSION = { kind: "session" as const };
const PATHS: AgendaPaths = {
  agenda: (query) => myAgendaHref(query),
  appointment: (id) => routes.myAppointment(id),
};

export async function markMyAppointment(formData: FormData): Promise<void> {
  await requireProfessional();
  await markFor(SESSION, PATHS, formData);
}

export async function removeMyBlock(formData: FormData): Promise<void> {
  await requireProfessional();
  await removeBlockFor(SESSION, PATHS, formData);
}

export async function createMyBlock(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  await requireProfessional();
  return createBlockFor(SESSION, PATHS, formData);
}
