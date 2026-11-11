import "server-only";
import { now } from "@/lib/fechas/fechas";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { slugCandidate, slugSetAsideSince } from "../dominio/slug";

const MAX_ATTEMPTS = 20;

// Every link in use and every link a barbershop left (D-61, set aside so its
// QR and posters keep working) are public: public_read on barbershops and on
// barbershop_slug_history. Looking them up reveals nothing new. A link left
// SLUG_SET_ASIDE_DAYS ago or more is free again (decision P12), so it is not
// counted as taken. The database still decides (unique slug,
// guard_barbershop_slug) if two writes race for the same link.

function stillSetAside() {
  return slugSetAsideSince(now()).toISOString();
}

// First link not taken yet.
export async function findFreeSlug(base: string): Promise<string> {
  const candidates = Array.from({ length: MAX_ATTEMPTS }, (_, index) =>
    slugCandidate(base, index + 1),
  );
  const supabase = createSupabasePublicClient();
  const [inUse, setAside] = await Promise.all([
    supabase.from("barbershops").select("slug").in("slug", candidates),
    supabase
      .from("barbershop_slug_history")
      .select("slug")
      .in("slug", candidates)
      .gt("retired_at", stillSetAside()),
  ]);
  const taken = new Set(
    [...(inUse.data ?? []), ...(setAside.data ?? [])].map((row) => row.slug),
  );

  return (
    candidates.find((candidate) => !taken.has(candidate)) ??
    slugCandidate(base, MAX_ATTEMPTS + 1 + Math.floor(Math.random() * 1000))
  );
}

// D-61, the chip under "Link nuevo": free for this barbershop when no other
// barbershop uses it now or left it less than SLUG_SET_ASIDE_DAYS ago. A
// link the barbershop itself left is free for it to go back to.
export async function isSlugAvailable(
  slug: string,
  barbershopId: string,
): Promise<boolean> {
  const supabase = createSupabasePublicClient();
  const [inUse, setAside] = await Promise.all([
    supabase.from("barbershops").select("id").eq("slug", slug).maybeSingle(),
    supabase
      .from("barbershop_slug_history")
      .select("barbershop_id")
      .eq("slug", slug)
      .gt("retired_at", stillSetAside())
      .maybeSingle(),
  ]);
  if (inUse.error) throw inUse.error;
  if (setAside.error) throw setAside.error;
  return (
    (inUse.data === null || inUse.data.id === barbershopId) &&
    (setAside.data === null || setAside.data.barbershop_id === barbershopId)
  );
}
