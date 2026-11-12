// The limits on public bookings (task 3.5, founder 2026-11-12). The database
// enforces them (migration add_booking_limits): private.max_bookings_per_ip_hour
// and private.max_upcoming_web_per_customer return the same numbers, and
// supabase/tests/database/31_booking_limits checks them.

// Bookings per hour from one IP in one barbershop.
export const MAX_BOOKINGS_PER_IP_HOUR = 10;

// Upcoming web appointments one email can hold in one barbershop.
export const MAX_UPCOMING_WEB_PER_CUSTOMER = 5;

// What the per-IP limit counts (task 3.5b). An IPv6 visitor usually holds a
// whole /64 network (mobile operators in Colombia hand them out), so counting
// the full address would let anyone reset the limit by changing the last
// half. IPv6 counts by its /64; IPv4, and IPv4 written inside IPv6, by the
// address. Anything else is counted as it came.
export function ipLimitKey(ip: string): string {
  const value = ip.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped?.[1]) return mapped[1];
  if (!value.includes(":")) return value;

  const groups = expandIpv6(value);
  if (!groups) return value;
  // IPv4 inside IPv6 written in hex (::ffff:b534:a07): the IPv4 itself.
  if (
    groups.slice(0, 5).every((group) => /^0+$/.test(group)) &&
    groups[5] === "ffff"
  ) {
    const [high, low] = [groups[6], groups[7]].map((group) =>
      parseInt(group ?? "0", 16),
    );
    return [high! >> 8, high! & 255, low! >> 8, low! & 255].join(".");
  }
  const network = groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":");
  return `${network}::/64`;
}

// The eight 16-bit groups of an IPv6 address, or null when it is not one.
function expandIpv6(address: string): string[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  return groups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) ? groups : null;
}
