"use server";

import { redirect } from "next/navigation";
import { barberAgendaHref, routes } from "@/lib/routes";
import { isLinkToken } from "@/lib/tokens/link-token";
import {
  createBlockFor,
  markFor,
  removeBlockFor,
  type AgendaPaths,
  type BlockState,
} from "./barber-core";

// "Mi agenda" of a barber by their private link (task 4.4). The token comes
// from the form; it is checked here and again in the database (migration
// add_barber_agenda). The rules are those of ./barber-core.ts.

function linkOf(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!isLinkToken(token)) return null;
  const paths: AgendaPaths = {
    agenda: (query) => barberAgendaHref(token, query),
    appointment: (id) => routes.barberAppointment(token, id),
  };
  return { source: { kind: "link" as const, token }, paths };
}

export async function markAppointment(formData: FormData): Promise<void> {
  const link = linkOf(formData);
  // Never a redirect built from something that is not a token.
  if (!link) redirect(routes.home);
  await markFor(link.source, link.paths, formData);
}

export async function removeBlock(formData: FormData): Promise<void> {
  const link = linkOf(formData);
  if (!link) redirect(routes.home);
  await removeBlockFor(link.source, link.paths, formData);
}

export async function createBlock(
  _previous: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const link = linkOf(formData);
  if (!link) return { status: "failed", error: "link_invalid", values: {} };
  return createBlockFor(link.source, link.paths, formData);
}
