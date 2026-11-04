import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { slugCandidate } from "../dominio/slug";

const MAX_ATTEMPTS = 20;

// First link not taken yet. Slugs are public (public_read on barbershops), so
// looking them up reveals nothing new. The unique constraint still decides if
// two signups race for the same one.
export async function findFreeSlug(base: string): Promise<string> {
  const candidates = Array.from({ length: MAX_ATTEMPTS }, (_, index) =>
    slugCandidate(base, index + 1),
  );
  const { data } = await createSupabasePublicClient()
    .from("barbershops")
    .select("slug")
    .in("slug", candidates);
  const taken = new Set(data?.map((row) => row.slug));

  return (
    candidates.find((candidate) => !taken.has(candidate)) ??
    slugCandidate(base, MAX_ATTEMPTS + 1 + Math.floor(Math.random() * 1000))
  );
}
