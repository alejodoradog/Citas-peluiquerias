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
    // Task 7.6b: a professional with their own account. Until they accept
    // the terms (with their password, from the invitation) that screen.
    case "professional":
      return access.acceptedTerms ? routes.myAgenda : routes.newPassword;
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

// "Mi agenda" (task 7.6b): a professional who accepted the terms. Anyone
// else goes home; a professional who has not accepted them yet goes to the
// screen where they do.
export async function requireProfessional() {
  const access = await getCurrentAccess();
  if (access.kind !== "professional" || !access.acceptedTerms) {
    redirect(homeFor(access));
  }
  return access;
}

// For sign-in and sign-up screens: someone already inside goes home.
export async function redirectIfSignedIn() {
  const access = await getCurrentAccess();
  if (
    access.kind === "owner" ||
    access.kind === "super_admin" ||
    access.kind === "professional"
  ) {
    redirect(homeFor(access));
  }
}
