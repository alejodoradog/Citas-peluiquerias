import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

// The visitor's IP as Vercel gives it (x-real-ip, else the first hop of
// x-forwarded-for), for Turnstile and for the limit of bookings per IP (task
// 3.5). Null when there is none, or it is this same machine (local runs and
// CI), so the limit does not apply there.
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export async function clientIp(): Promise<string | null> {
  const list = await headers();
  const ip =
    list.get("x-real-ip")?.trim() ||
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!ip || ip.length > 64 || LOOPBACK.has(ip)) return null;
  return ip;
}

// What the database keeps instead of the IP (private.booking_ip_hits): a
// keyed hash, so a leaked table does not give the IPs back by trying all of
// them. 64 hex characters, as private.is_token_hash asks.
export function hashClientIp(ip: string): string {
  const key = process.env.SUPABASE_SECRET_KEY || "yapoin-desarrollo";
  return createHmac("sha256", key).update(ip, "utf8").digest("hex");
}
