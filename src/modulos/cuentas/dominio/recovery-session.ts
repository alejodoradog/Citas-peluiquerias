// A new password can be set only from the session a recovery link opened,
// and only shortly after: a session someone left open on the shop's phone
// must not be enough to take over the account.

const RECOVERY_METHODS = ["recovery", "otp"];
const MAX_AGE_SECONDS = 60 * 60;

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
