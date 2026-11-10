// A new password can be set only from the session a recovery link opened,
// and only shortly after: a session someone left open on the shop's phone
// must not be enough to take over the account.

const RECOVERY_METHODS = ["recovery", "otp"];
const MAX_AGE_SECONDS = 60 * 60;

// Email links last 24 hours (EMAIL_LINK_HOURS) so a new owner has time to
// confirm. A recovery link hands over the account, so the app accepts it only
// within an hour of being sent, as its email says. Without a send time it
// leaves the decision to Auth's own expiry.
export const RECOVERY_LINK_MAX_AGE_MS = 60 * 60 * 1000;

export function recoveryLinkIsFresh(
  sentAt: string | null | undefined,
  nowMs: number,
): boolean {
  if (!sentAt) return true;
  const sentMs = Date.parse(sentAt);
  if (Number.isNaN(sentMs)) return true;
  return nowMs - sentMs <= RECOVERY_LINK_MAX_AGE_MS;
}

type AuthMethodEntry = { method: string; timestamp: number };

// amr is the list of ways this session was authenticated (JWT claim).
export function cameFromRecentRecovery(
  amr: readonly (AuthMethodEntry | string)[] | undefined,
  nowSeconds: number,
): boolean {
  return (amr ?? []).some(
    (entry) =>
      typeof entry !== "string" &&
      RECOVERY_METHODS.includes(entry.method) &&
      nowSeconds - entry.timestamp <= MAX_AGE_SECONDS,
  );
}
