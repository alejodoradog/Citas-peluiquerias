import "server-only";
import { createHash, randomBytes } from "node:crypto";

// The customer's private links (task 3.4: "Gestionar mi cita" and "Mis
// citas"). The token is 32 random bytes and only its SHA-256 is stored (64
// hex characters, private.is_token_hash), so the database never holds a link
// that works. The barber's private link of task 4.4 used it too, until task
// 7.6c.

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

// The shape newLinkToken gives: 32 bytes in base64url, 43 characters. A path
// that is not one is refused before asking the database.
export function isLinkToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
