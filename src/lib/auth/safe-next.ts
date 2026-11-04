// Where a link from an email may send the user after signing in. Only these
// internal paths are accepted, so a crafted link cannot redirect elsewhere.
const ALLOWED_NEXT = ["/nueva-clave"] as const;
const FALLBACK = "/panel";

export function safeNextPath(next: string | null | undefined): string {
  return (ALLOWED_NEXT as readonly string[]).includes(next ?? "")
    ? (next as string)
    : FALLBACK;
}
