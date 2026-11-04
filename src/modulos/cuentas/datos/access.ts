import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { now, type BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { cameFromRecentRecovery } from "../dominio/recovery-session";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

// Who is using the app right now. Decided only from the profiles table, which
// RLS filters (inactive profiles are invisible), never from user metadata,
// which the user can change at will.
export type Access =
  | { kind: "anonymous" }
  | { kind: "no_access" }
  | {
      kind: "owner";
      name: string;
      barbershop: {
        id: string;
        name: string;
        slug: string;
        subscriptionStatus: SubscriptionStatus;
        expiresOn: BogotaDate;
      };
    }
  | { kind: "super_admin"; name: string };

// The session is checked against the current time (token expiry), so this
// always runs at request time, never while prerendering.
export const getCurrentAccess = cache(async (): Promise<Access> => {
  await connection();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { kind: "anonymous" };
  }

  // A failed query throws instead of passing for "no access", so a network
  // hiccup never signs a valid owner out.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name, barbershop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw profileError;
  }
  if (!profile) {
    return { kind: "no_access" };
  }
  if (profile.role === "super_admin") {
    return { kind: "super_admin", name: profile.full_name };
  }
  if (profile.role !== "owner" || !profile.barbershop_id) {
    return { kind: "no_access" };
  }

  const { data: barbershop, error: barbershopError } = await supabase
    .from("barbershops")
    .select("id, name, slug, subscription_status, expires_on")
    .eq("id", profile.barbershop_id)
    .maybeSingle();
  if (barbershopError) {
    throw barbershopError;
  }
  if (!barbershop) {
    return { kind: "no_access" };
  }
  return {
    kind: "owner",
    name: profile.full_name,
    barbershop: {
      id: barbershop.id,
      name: barbershop.name,
      slug: barbershop.slug,
      subscriptionStatus: barbershop.subscription_status,
      expiresOn: barbershop.expires_on,
    },
  };
});

// True when this session was opened by a recovery link in the last hour.
export async function hasRecentRecoverySession(): Promise<boolean> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return cameFromRecentRecovery(
    data?.claims.amr,
    Math.floor(now().getTime() / 1000),
  );
}
