import "server-only";

// The server half of Turnstile (task 3.5) for what Supabase Auth does not
// check itself: the public booking. Each token works once and for 5 minutes.
// Without TURNSTILE_SECRET_KEY, production refuses everything (fail closed)
// and development lets it through, so a local run without keys still works.
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  // Cloudflare's tokens are at most 2048 characters.
  if (!token || token.length > 2048) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
