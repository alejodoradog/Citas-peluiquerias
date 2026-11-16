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

// The panel is never cached on the server: every screen reads the session
// (getCurrentAccess calls connection()), so a revalidatePath on a panel route
// only expires its static shell, which holds no barbershop data. What keeps
// the owner's other screens fresh after a save is the router: in Next.js
// 16.4, a Server Action that calls revalidatePath (or updateTag) makes the
// browser drop every page it kept and fetch each again on the next visit
// (server-action-reducer: invalidateBfCache and invalidateEntirePrefetchCache).
// So each action names the literal paths whose screens show what changed,
// and nothing broader. A route pattern inside the (panel) group must carry
// the group ("/(panel)/panel/profesionales/[id]"); without it, it matches no page.

// For data that must stop being served at once (a deleted barbershop: its
// WhatsApp, deposit account and images, Ley 1581). Server Actions only.
export function expirePublicProfile(barbershopId: string): void {
  updateTag(publicProfileTag(barbershopId));
}
