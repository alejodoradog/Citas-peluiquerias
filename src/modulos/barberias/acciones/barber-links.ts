"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/lib/routes";
import { barberAgendaUrl } from "@/lib/sitio";
import { hashLinkToken, newLinkToken } from "@/lib/tokens/link-token";
import { requireOwner } from "@/modulos/cuentas/guards";
import {
  getBarber,
  turnOffBarberLinkRow,
  writeBarberLinkHash,
} from "../datos/barbers";
import type { BarberLinkErrorCode } from "../dominio/barber-link";
import { isId } from "../dominio/service";

// D-56, a barber's private link (task 2.3). The token exists only here and in
// the answer to the owner's tap: the database keeps its SHA-256, no page
// renders it, and nothing logs it. Each issue makes a new token, so the
// previous link stops working in the same statement.

export type IssueBarberLinkResult =
  { ok: true; url: string } | { ok: false; error: BarberLinkErrorCode };

export type BarberLinkCommandResult =
  { ok: true } | { ok: false; error: BarberLinkErrorCode };

type LinkTarget =
  | { ok: true; barbershopId: string; barberId: string }
  | { ok: false; error: BarberLinkErrorCode };

// A barber of the owner's own barbershop, never one the browser names, and
// never the owner's barber. An inactive barber gets links too: they still
// serve the appointments they had (decision 4).
async function linkTarget(barberId: unknown): Promise<LinkTarget> {
  const { barbershop } = await requireOwner();
  const barber = isId(barberId)
    ? await getBarber(barbershop.id, barberId)
    : null;
  if (!barber) return { ok: false, error: "not_found" };
  if (barber.is_owner) return { ok: false, error: "owner_has_no_link" };
  return { ok: true, barbershopId: barbershop.id, barberId: barber.id };
}

function revalidateLink(barberId: string) {
  revalidatePath(routes.panelBarbers);
  revalidatePath(routes.panelBarberEdit(barberId));
  revalidatePath(routes.panelBarberLink(barberId));
}

// "Copiar link nuevo" and "Crear link nuevo".
export async function issueBarberLink(
  barberId: string,
): Promise<IssueBarberLinkResult> {
  const target = await linkTarget(barberId);
  if (!target.ok) return target;
  const token = newLinkToken();
  const saved = await writeBarberLinkHash(
    target.barbershopId,
    target.barberId,
    hashLinkToken(token),
  );
  if (!saved) return { ok: false, error: "unknown" };
  revalidateLink(target.barberId);
  return { ok: true, url: barberAgendaUrl(token) };
}

// "Desactivar link", after its confirmation.
export async function turnOffBarberLink(
  barberId: string,
): Promise<BarberLinkCommandResult> {
  const target = await linkTarget(barberId);
  if (!target.ok) return target;
  if (!(await turnOffBarberLinkRow(target.barbershopId, target.barberId))) {
    return { ok: false, error: "unknown" };
  }
  revalidateLink(target.barberId);
  return { ok: true };
}
