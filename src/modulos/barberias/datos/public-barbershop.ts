import "server-only";
import { now } from "@/lib/fechas/fechas";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSlug, slugSetAsideSince } from "../dominio/slug";

// The name of the barbershop behind a public link, as anyone can read it
// (public_read on barbershops). Null when the link is not one.
export async function findBarbershopNameBySlug(
  slug: string,
): Promise<string | null> {
  if (!isSlug(slug)) return null;
  const { data, error } = await createSupabasePublicClient()
    .from("barbershops")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}

// D-61: a link a barbershop left keeps leading to it for SLUG_SET_ASIDE_DAYS
// days (decisions P1 and P12 of task 2.4). The current link of the
// barbershop that left this one, or null when no barbershop did or it left
// it that long ago. anon reads slug, barbershop_id and retired_at of the
// history and the slug of barbershops, which is all this join needs.
export async function resolveRetiredSlug(slug: string): Promise<string | null> {
  if (!isSlug(slug)) return null;
  const { data, error } = await createSupabasePublicClient()
    .from("barbershop_slug_history")
    .select("barbershops(slug)")
    .eq("slug", slug)
    .gt("retired_at", slugSetAsideSince(now()).toISOString())
    .maybeSingle();
  if (error) throw error;
  return data?.barbershops?.slug ?? null;
}
