import "server-only";
import { cookies } from "next/headers";
import {
  ACTIVE_BARBERSHOP_COOKIE,
  ACTIVE_BARBERSHOP_MAX_AGE_SECONDS,
} from "../dominio/active-barbershop";

// The active barbershop's cookie (task 2.6). What it holds is only a choice:
// getCurrentAccess checks it against the owner's memberships on every
// request, so a forged or stale id falls back to the oldest barbershop. It is
// httpOnly, so no script on the page reads or changes it.

export async function readActiveBarbershopChoice(): Promise<
  string | undefined
> {
  return (await cookies()).get(ACTIVE_BARBERSHOP_COOKIE)?.value;
}

// Only Server Actions can set cookies. Callers check first that the id is one
// of the owner's barbershops.
export async function rememberActiveBarbershop(id: string): Promise<void> {
  (await cookies()).set(ACTIVE_BARBERSHOP_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_BARBERSHOP_MAX_AGE_SECONDS,
  });
}

// On sign-out: the next account on this browser starts from its own oldest
// barbershop (it would anyway; this leaves nothing behind).
export async function forgetActiveBarbershop(): Promise<void> {
  (await cookies()).delete({ name: ACTIVE_BARBERSHOP_COOKIE, path: "/" });
}
