import "server-only";
import { revalidateTag, updateTag } from "next/cache";

// The public profile of a barbershop (task 3.2) is cached for a short time.
// Every action that changes what it shows (data, logo, services, barbers,
// hours, holidays, policies, link) refreshes it, so the owner's change is on
// the booking page at once. Availability and the booking are never cached.

export function publicProfileTag(barbershopId: string): string {
  return `public-profile:${barbershopId}`;
}

export function refreshPublicProfile(barbershopId: string): void {
  revalidateTag(publicProfileTag(barbershopId), "max");
}

// For data that must stop being served at once (a deleted barbershop: its
// WhatsApp, deposit account and images, Ley 1581). Server Actions only.
export function expirePublicProfile(barbershopId: string): void {
  updateTag(publicProfileTag(barbershopId));
}
