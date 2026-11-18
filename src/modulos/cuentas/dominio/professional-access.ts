import { EMAIL_LINK_HOURS } from "./email-link";

// "Acceso a su agenda" in the owner's card of a professional (task 7.6b,
// decision 0010): what the database says (barber_account_status) and what
// the card shows and lets the owner do.

// barber_account_status (migration add_professional_account_app).
export type AccountState = "none" | "invited" | "active" | "revoked";

export type AccountStatus = {
  state: AccountState;
  sentAt: Date | null;
  expiresAt: Date | null;
};

export type AccessView =
  // Without email there is nowhere to invite.
  | { kind: "no_email" }
  // An inactive professional is not invited (barber_inactive).
  | { kind: "inactive" }
  | { kind: "not_invited" }
  // The email link works until `until`: 24 hours after it was sent, or the
  // 7 days of the invitation if that comes first.
  | { kind: "invited"; until: Date }
  | { kind: "expired" }
  | { kind: "active" }
  | { kind: "revoked" };

const LINK_MS = EMAIL_LINK_HOURS * 60 * 60 * 1000;

export function accessView(input: {
  status: AccountStatus;
  hasEmail: boolean;
  active: boolean;
  now: Date;
}): AccessView {
  const { status, hasEmail, active, now } = input;
  if (status.state === "active") return { kind: "active" };
  if (status.state === "invited") {
    const sent = status.sentAt?.getTime() ?? 0;
    const ends = Math.min(
      sent + LINK_MS,
      status.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
    );
    return now.getTime() < ends
      ? { kind: "invited", until: new Date(ends) }
      : { kind: "expired" };
  }
  if (!hasEmail) return { kind: "no_email" };
  if (!active) return { kind: "inactive" };
  return status.state === "revoked"
    ? { kind: "revoked" }
    : { kind: "not_invited" };
}

// What the card offers in each state.
export function accessActions(kind: AccessView["kind"]): {
  invite: "invite" | "resend" | null;
  revoke: boolean;
} {
  switch (kind) {
    case "not_invited":
    case "revoked":
      return { invite: "invite", revoke: false };
    case "invited":
    case "expired":
      return { invite: "resend", revoke: true };
    case "active":
      return { invite: null, revoke: true };
    case "no_email":
    case "inactive":
      return { invite: null, revoke: false };
  }
}

// Why inviting or taking the access away did not work, as the card says it.
// The hints of invite_barber and revoke_barber_account, email_taken (a
// status of invite_barber: never says whose the account is), and Auth's own
// failures, after which the owner can try again.
export type AccessRefusal =
  | "email_taken"
  | "barber_not_found"
  | "barbershop_read_only"
  | "barber_is_owner"
  | "barber_inactive"
  | "email_required"
  | "already_linked"
  | "invitation_pending_other_email"
  | "invitation_limit"
  | "barber_without_account"
  | "auth_rate_limited"
  | "auth_failed"
  | "unknown";

const HINTS: ReadonlySet<string> = new Set<AccessRefusal>([
  "barber_not_found",
  "barbershop_read_only",
  "barber_is_owner",
  "barber_inactive",
  "email_required",
  "already_linked",
  "invitation_pending_other_email",
  "invitation_limit",
  "barber_without_account",
]);

export function toAccessRefusal(error: {
  hint?: string | null;
}): AccessRefusal {
  const hint = error.hint ?? "";
  return HINTS.has(hint) ? (hint as AccessRefusal) : "unknown";
}

// Auth's answer to an invitation it could not send. Its message never
// reaches the screen nor the logs: it can carry the email.
export function toAuthInviteRefusal(error: {
  status?: number;
  code?: string;
}): AccessRefusal {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "auth_rate_limited";
  }
  return "auth_failed";
}

// Task 8.16: the invitation that goes out when the owner saves a
// professional. It follows the same rules as "Invitar" (the database checks
// them again); this only decides whether to ask at all, so saving never
// resends anything nor invites someone who cannot be invited.
export function shouldInviteOnSave(input: {
  isOwner: boolean;
  active: boolean;
  // What was saved before: null for a new professional.
  previousEmail: string | null;
  email: string | null;
  // The state of the access before saving: "none" for a new professional.
  state: AccountState;
}): boolean {
  const email = (input.email ?? "").trim().toLowerCase();
  if (input.isOwner || !input.active || email === "") return false;
  // An invitation pending or an account already there: "Reenviar
  // invitación" and "Quitar acceso" are the way, not saving.
  if (input.state === "invited" || input.state === "active") return false;
  return email !== (input.previousEmail ?? "").trim().toLowerCase();
}

// What the list says after saving, passed in the address as one of these
// short codes (never the email: it is read from the database): "sent", or
// why not.
export const SAVE_INVITE_REFUSALS = [
  "email_taken",
  "barbershop_read_only",
  "already_linked",
  "invitation_pending_other_email",
  "invitation_limit",
  "auth_rate_limited",
  "auth_failed",
  "unknown",
] as const satisfies readonly AccessRefusal[];

export type SaveInviteNotice = "sent" | (typeof SAVE_INVITE_REFUSALS)[number];

const SAVE_INVITE_NOTICES: ReadonlySet<string> = new Set([
  "sent",
  ...SAVE_INVITE_REFUSALS,
]);

export function parseSaveInviteNotice(value: unknown): SaveInviteNotice | null {
  return typeof value === "string" && SAVE_INVITE_NOTICES.has(value)
    ? (value as SaveInviteNotice)
    : null;
}

// Any other refusal (the ones the checks before asking keep from happening)
// reads as "unknown".
export function toSaveInviteNotice(error: AccessRefusal): SaveInviteNotice {
  return parseSaveInviteNotice(error) ?? "unknown";
}
