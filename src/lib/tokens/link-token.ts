import "server-only";
import { createHash, randomBytes } from "node:crypto";

// A barber's private link (spec: "Link privado del barbero"). The token is 32
// random bytes and only its SHA-256 is stored (barbers.link_token_hash, 64
// hex characters, private.is_token_hash), so the database never holds a link
// that works.

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

// For a new barber: the token is thrown away, because the link is issued
// later, each time the owner copies or sends it (task 2.3).
export function newLinkTokenHash(): string {
  return hashLinkToken(newLinkToken());
}

// The shape newLinkToken gives: 32 bytes in base64url, 43 characters. A path
// that is not one is refused before asking the database.
export function isLinkToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
