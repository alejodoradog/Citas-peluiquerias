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
