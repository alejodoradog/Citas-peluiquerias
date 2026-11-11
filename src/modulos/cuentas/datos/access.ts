import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { now, type BogotaDate } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  pickActiveBarbershop,
  sortByCreation,
} from "../dominio/active-barbershop";
import { cameFromRecentRecovery } from "../dominio/recovery-session";
import { readActiveBarbershopChoice } from "./active-barbershop";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

// One of the owner's barbershops (sedes), as the switcher lists it (task
// 2.6), oldest first.
export type OwnerBarbershop = {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
};

// Who is using the app right now. Decided only from the profiles and
// memberships tables, which RLS filters (inactive profiles see nothing), never
// from user metadata, which the user can change at will.
export type Access =
  | { kind: "anonymous" }
  | { kind: "no_access" }
  | {
      kind: "owner";
      name: string;
      // The sign-in email, shown in Más › Tu cuenta (D-50).
      email: string;
      // The active barbershop: every screen and action of the panel reads
      // and writes this one only.
      barbershop: OwnerBarbershop & {
        subscriptionStatus: SubscriptionStatus;
        expiresOn: BogotaDate;
      };
      // Every barbershop of the owner, oldest first, the active one included.
      barbershops: OwnerBarbershop[];
      // Last day of the company trial: the one of the oldest barbershop,
      // which create_barbershop gives every new sede (spec, P7).
      companyTrialEndsOn: BogotaDate;
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
    .select("full_name, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw profileError;
  }
  if (!profile) {
    return { kind: "no_access" };
  }
  if (profile.is_super_admin) {
    return { kind: "super_admin", name: profile.full_name };
  }

  // An owner reaches their barbershops through memberships (decision 0006).
  // The active one is the one the cookie names, but only if it is in this
  // list, which RLS filters to the owner's own memberships; otherwise the
  // oldest one, the same one create_barbershop takes the company trial from.
  const [{ data: memberships, error: membershipsError }, chosenId] =
    await Promise.all([
      supabase
        .from("memberships")
        .select(
          "barbershops(id, name, slug, logo_path, subscription_status, expires_on, trial_ends_on, created_at)",
        )
        .eq("user_id", user.id)
        .eq("role", "owner"),
      readActiveBarbershopChoice(),
    ]);
  if (membershipsError) {
    throw membershipsError;
  }
  const owned = sortByCreation(
    (memberships ?? []).flatMap((membership) =>
      membership.barbershops
        ? [
            {
              ...membership.barbershops,
              createdAt: membership.barbershops.created_at,
            },
          ]
        : [],
    ),
  );
  const active = pickActiveBarbershop(owned, chosenId);
  const oldest = owned[0];
  if (!active || !oldest) {
    return { kind: "no_access" };
  }
  const summary = (barbershop: (typeof owned)[number]): OwnerBarbershop => ({
    id: barbershop.id,
    name: barbershop.name,
    slug: barbershop.slug,
    logoPath: barbershop.logo_path,
  });
  return {
    kind: "owner",
    name: profile.full_name,
    email: user.email ?? "",
    barbershop: {
      ...summary(active),
      subscriptionStatus: active.subscription_status,
      expiresOn: active.expires_on,
    },
    barbershops: owned.map(summary),
    companyTrialEndsOn: oldest.trial_ends_on,
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
