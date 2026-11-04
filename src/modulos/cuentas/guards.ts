import "server-only";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getCurrentAccess, type Access } from "./datos/access";

// Route guards for pages: where each kind of account belongs, and redirects
// for everyone else. Pages call these inside a Suspense boundary.

export function homeFor(access: Access): string {
  switch (access.kind) {
    case "owner":
      return routes.panel;
    case "super_admin":
      return routes.admin;
    // The sign-in page explains when an account has no access.
    case "no_access":
    case "anonymous":
      return routes.signIn;
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
