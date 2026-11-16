"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { routes } from "@/lib/routes";
import {
  accountToDelete,
  barberOfShop,
  deleteAuthAccount,
  inviteInDatabase,
  revokeInDatabase,
  sendAuthInvitation,
} from "../datos/professional-access";
import type { AccessRefusal } from "../dominio/professional-access";
import { requireOwner } from "../guards";

// "Invitar", "Reenviar invitación" and "Quitar acceso" of the owner's card of
// a professional (task 7.6b, decision 0010). The id comes from the browser,
// so it is only a question: the professional must be of the owner's active
// barbershop (RLS), and then the database checks again that the owner
// reaches them before it answers anything. The service key acts only on what
// the database answered (../datos/professional-access.ts).

export type AccessResult = { ok: true } | { ok: false; error: AccessRefusal };

const isId = (value: unknown): value is string =>
  typeof value === "string" && z.uuid().safeParse(value).success;

// Where the email's button lands. The email template builds its own link
// from Auth's site URL (supabase/templates/invite.html); this is what Auth
// keeps for {{ .RedirectTo }}, and Auth only accepts it when it is in its
// allow list. The origin is the one of this Server Action's request, which
// Next.js checks against the host.
async function confirmUrl(): Promise<string | undefined> {
  const origin = (await headers()).get("origin");
  if (!origin) return undefined;
  try {
    return new URL(routes.confirmEmailLink, origin).toString();
  } catch {
    return undefined;
  }
}

async function ownersBarber(barberId: unknown) {
  const { barbershop } = await requireOwner();
  if (!isId(barberId)) return null;
  const barber = await barberOfShop(barbershop.id, barberId);
  return barber ? { barbershop, barberId: barber.id } : null;
}

// Deletes the account the database lets this owner delete for this
// professional (revoked, or the orphan of an invitation that did not join),
// if any. False only when there was one and Auth refused to delete it.
async function cleanAccount(barberId: string): Promise<boolean> {
  const stale = await accountToDelete(barberId);
  return stale === null || (await deleteAuthAccount(stale));
}

export async function inviteProfessional(
  barberId: string,
): Promise<AccessResult> {
  const target = await ownersBarber(barberId);
  if (!target) return { ok: false, error: "barber_not_found" };

  let answer = await inviteInDatabase(target.barberId);
  if (!answer.ok) return answer;
  // An account left in Auth for this professional: the one the owner took
  // away, or the orphan of an invitation that did not join (Auth's clock).
  // Once the database says which, it is deleted and the invitation is asked
  // again, once. Any other taken email stays taken, and the owner is never
  // told whose it is.
  if (answer.status !== "invited") {
    const stale = await accountToDelete(target.barberId);
    if (stale !== null) {
      if (!(await deleteAuthAccount(stale))) {
        return { ok: false, error: "auth_failed" };
      }
      answer = await inviteInDatabase(target.barberId);
      if (!answer.ok) return answer;
    }
  }
  if (answer.status === "email_taken") {
    return { ok: false, error: "email_taken" };
  }
  if (answer.status !== "invited" || !answer.email) {
    return { ok: false, error: "auth_failed" };
  }

  // Exactly the email the database invited. If Auth fails here, the
  // invitation stays in the database and "Reenviar invitación" tries again.
  const sent = await sendAuthInvitation(answer.email, {
    redirectTo: await confirmUrl(),
    establishment: target.barbershop.name,
  });
  revalidatePath(routes.panelBarberEdit(target.barberId));
  return sent.ok ? { ok: true } : sent;
}

export async function revokeProfessionalAccess(
  barberId: string,
): Promise<AccessResult> {
  const target = await ownersBarber(barberId);
  if (!target) return { ok: false, error: "barber_not_found" };

  const revoked = await revokeInDatabase(target.barberId);
  if (!revoked.ok) return revoked;
  // From here the account reaches nothing (the database unjoined it and
  // turned its profile off). Deleting it in Auth is the cleanup; if Auth
  // fails, the next invitation of this professional tries again.
  await cleanAccount(target.barberId);
  revalidatePath(routes.panelBarberEdit(target.barberId));
  return { ok: true };
}
