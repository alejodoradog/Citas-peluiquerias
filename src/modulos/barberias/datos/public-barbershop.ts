import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSlug } from "../dominio/slug";

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

// D-61: a link a barbershop left keeps leading to it (decision P1 of task
// 2.4). The current link of the barbershop that left this one, or null when
// no barbershop did. anon reads slug and barbershop_id of the history and
// the slug of barbershops, which is all this join needs.
export async function resolveRetiredSlug(slug: string): Promise<string | null> {
  if (!isSlug(slug)) return null;
  const { data, error } = await createSupabasePublicClient()
    .from("barbershop_slug_history")
    .select("barbershops(slug)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data?.barbershops?.slug ?? null;
}
