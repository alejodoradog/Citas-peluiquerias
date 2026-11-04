import { routes } from "@/lib/routes";

// Where a link from an email may send the user after signing in. Only these
// internal paths are accepted, so a crafted link cannot redirect elsewhere.
const ALLOWED_NEXT: readonly string[] = [routes.newPassword];
const FALLBACK = routes.panel;

export function safeNextPath(next: string | null | undefined): string {
  return next && ALLOWED_NEXT.includes(next) ? next : FALLBACK;
}
