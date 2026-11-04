import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { now } from "@/lib/fechas/fechas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cameFromRecentRecovery } from "@/modulos/cuentas/dominio/recovery-session";

// Who is using the app right now. Decided only from the profiles table, which
// RLS filters (inactive profiles are invisible), never from user metadata,
// which the user can change at will.
export type Access =
  | { kind: "anonymous" }
  | { kind: "no_access" }
  | {
      kind: "owner";
      ownerName: string;
      barbershop: { name: string; slug: string; expiresOn: string };
    }
  | { kind: "super_admin"; name: string };

export const getCurrentAccess = cache(async (): Promise<Access> => {
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
  if (profile.role !== "owner") {
    return { kind: "no_access" };
  }

  const { data: barbershop, error: barbershopError } = await supabase
    .from("barbershops")
    .select("name, slug, expires_on")
    .eq("id", profile.barbershop_id ?? "")
    .maybeSingle();
  if (barbershopError) {
    throw barbershopError;
  }
  if (!barbershop) {
    return { kind: "no_access" };
  }
  return {
    kind: "owner",
    ownerName: profile.full_name,
    barbershop: {
      name: barbershop.name,
      slug: barbershop.slug,
      expiresOn: barbershop.expires_on,
    },
  };
});

// True when this session was opened by a recovery link in the last hour.
export async function hasRecentRecoverySession(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return cameFromRecentRecovery(
    data?.claims.amr,
    Math.floor(now().getTime() / 1000),
  );
}

// Where each kind of account lands after signing in.
export function homeFor(access: Access): string {
  switch (access.kind) {
    case "owner":
      return "/panel";
    case "super_admin":
      return "/admin";
    case "no_access":
      return "/salir";
    case "anonymous":
      return "/ingresar";
  }
}

export async function requireOwner() {
  const access = await getCurrentAccess();
  if (access.kind !== "owner") {
    redirect(homeFor(access));
  }
  return access;
}

export async function requireSuperAdmin() {
  const access = await getCurrentAccess();
  if (access.kind !== "super_admin") {
    redirect(homeFor(access));
  }
  return access;
}

// For sign-in and sign-up screens: someone already inside goes home.
export async function redirectIfSignedIn() {
  const access = await getCurrentAccess();
  if (access.kind === "owner" || access.kind === "super_admin") {
    redirect(homeFor(access));
  }
}
