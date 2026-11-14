// Task 5.2: Resend signs its webhooks with Svix. The signed content is
// "<svix-id>.<svix-timestamp>.<body>", the key is the base64 after "whsec_"
// in the secret, and svix-signature lists one or more "v1,<base64>" values.
// A delivery older or newer than 5 minutes is refused, so a captured one
// cannot be replayed later. No imports, so Deno and Vitest share this file.

export const TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

// Compared in constant time, so a wrong guess does not tell how much of it
// was right.
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function signatureOf(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return bytesToBase64(signed);
}

export async function verifySvix(
  secret: string,
  headers: SvixHeaders,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!secret.startsWith("whsec_") || secret.length < 16) return false;
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS)
    return false;
  let expected: string;
  try {
    expected = await signatureOf(secret, id, timestamp, body);
  } catch {
    return false;
  }
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    return version === "v1" && value !== undefined && sameText(value, expected);
  });
}

// The queue's message id that send-notifications put in the tags, in any of
// the shapes Resend may send them.
export function notificationIdOf(event: unknown): string | null {
  const tags = (event as { data?: { tags?: unknown } })?.data?.tags;
  const value = Array.isArray(tags)
    ? (tags as { name?: unknown; value?: unknown }[]).find(
        (tag) => tag?.name === "notification_id",
      )?.value
    : (tags as Record<string, unknown> | undefined)?.notification_id;
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

// The events the queue records: a bounce and a complaint (decision E3).
export function eventCodeOf(event: unknown): "bounced" | "complained" | null {
  const type = (event as { type?: unknown })?.type;
  if (type === "email.bounced") return "bounced";
  if (type === "email.complained") return "complained";
  return null;
}
