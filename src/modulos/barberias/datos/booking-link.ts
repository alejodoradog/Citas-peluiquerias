import "server-only";
import { now } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugSetAsideSince, slugSetAsideUntil } from "../dominio/slug";

// D-61. Sessions update the slug of their own barbershops (column grant of
// task 1.2, member_update); the filter by id keeps a second barbershop of
// the same owner out. guard_barbershop_slug (add_slug_history) sets the old
// link aside and enforces who may take a link and how often it changes.

export type BookingLinkWriteResult =
  "changed" | "slug_taken" | "slug_change_limit" | "unknown";

type DatabaseError = { code?: string; hint?: string | null };

// 23505: another barbershop uses the link now (barbershops_slug_key) or left
// it (guard_barbershop_slug, hint slug_taken). 23514 with slug_change_limit:
// provisional decision P11. Anything else wrote nothing.
export function bookingLinkWriteError(
  error: DatabaseError,
): Exclude<BookingLinkWriteResult, "changed"> {
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23514" && error.hint === "slug_change_limit") {
    return "slug_change_limit";
  }
  return "unknown";
}

export async function updateBookingLink(
  barbershopId: string,
  slug: string,
): Promise<BookingLinkWriteResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .update({ slug })
    .eq("id", barbershopId)
    .select("id");
  if (error) return bookingLinkWriteError(error);
  return data.length === 1 ? "changed" : "unknown";
}

// A link the barbershop left that still leads to its current one, and until
// when (decision P12).
export type SetAsideLink = { slug: string; until: Date };

// D-61: the barbershop's links still set aside, the most recently left
// first. Read with the owner's session (member_read): only its own.
export async function listSetAsideLinks(
  barbershopId: string,
): Promise<SetAsideLink[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershop_slug_history")
    .select("slug, retired_at")
    .eq("barbershop_id", barbershopId)
    .gt("retired_at", slugSetAsideSince(now()).toISOString())
    .order("retired_at", { ascending: false })
    .order("slug");
  if (error) throw error;
  return data.map((row) => ({
    slug: row.slug,
    until: slugSetAsideUntil(new Date(row.retired_at)),
  }));
}
