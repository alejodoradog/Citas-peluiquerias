// The state of a barber's private link (D-53, D-54 and D-56; task 2.3).
// - owner: the owner sees the whole agenda from their account, no link.
// - unsent: the link was never issued; its token was thrown away, so it opens
//   nothing ("link sin enviar").
// - active: issued and working ("Enviado el 3 de noviembre").
// - off: turned off; only a new token brings it back (the database enforces
//   it with the trigger guard_barber_link).
export type BarberLinkState = "owner" | "unsent" | "active" | "off";

export function barberLinkState(barber: {
  isOwner: boolean;
  linkActive: boolean;
  linkIssuedAt: string | null;
}): BarberLinkState {
  if (barber.isOwner) return "owner";
  if (!barber.linkActive) return "off";
  return barber.linkIssuedAt === null ? "unsent" : "active";
}

// Why issuing or turning off a link failed:
// - owner_has_no_link: the barber is the owner's own.
// - not_found: not an id, or not a barber of the owner's barbershop.
// - unknown: anything else.
export type BarberLinkErrorCode = "owner_has_no_link" | "not_found" | "unknown";
