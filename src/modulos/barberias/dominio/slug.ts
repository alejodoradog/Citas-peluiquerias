// The slug is the barbershop's public link: tuapp.co/<slug>.
// The database checks the same format (supabase/migrations, barbershops.slug).

// Top-level routes of the app, and links that could pass for the platform
// itself. The database checks the same list (barbershops_slug_not_reserved);
// slug.test.ts fails if they drift apart.
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "ayuda",
  "b",
  "c",
  "ingresar",
  "login",
  "nueva-clave",
  "panel",
  "privacidad",
  "recuperar-clave",
  "registro",
  "salir",
  "soporte",
  "terminos",
  "www",
] as const;

const MAX_BASE_LENGTH = 50;
const MIN_LENGTH = 3;
const PADDING = "barberia";

// The format the database checks (barbershops.slug): lowercase letters and
// digits in words joined by single hyphens, 3 to 60 characters. Anything
// else cannot be a barbershop's link, so it is not looked up.
const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 60 && SLUG_FORMAT.test(value);
}

export function slugFromName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/^-+|-+$/g, "");

  if (slug === "") {
    return PADDING;
  }
  const reserved = (RESERVED_SLUGS as readonly string[]).includes(slug);
  if (slug.length < MIN_LENGTH || reserved) {
    return `${slug}-${PADDING}`;
  }
  return slug;
}

// Attempt 1 is the base slug; later attempts add a number until one is free.
export function slugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}

// D-61, "Link nuevo": what the owner types after "yapoin.com/", turned into a
// link the way the sign-up turns a name into one (accents dropped, spaces and
// symbols as hyphens), but never cut, padded nor numbered: the owner gets
// exactly the link the screen shows.
export type NewSlugErrorCode = "slug_invalid" | "slug_reserved" | "slug_same";

export type NewSlugResult =
  { ok: true; slug: string } | { ok: false; error: NewSlugErrorCode };

export function normalizeSlugInput(input: string): string {
  return input
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseNewSlug(input: string, current: string): NewSlugResult {
  const slug = normalizeSlugInput(input);
  if (!isSlug(slug)) return { ok: false, error: "slug_invalid" };
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return { ok: false, error: "slug_reserved" };
  }
  if (slug === current) return { ok: false, error: "slug_same" };
  return { ok: true, slug };
}

// Decision P11 of task 2.4 (founder, 2026-11-10): a barbershop changes its
// link at most SLUG_CHANGE_LIMIT times in SLUG_CHANGE_WINDOW_DAYS days, going
// back to an old link included. The
// database enforces it (guard_barbershop_slug); slug.test.ts fails if the two
// copies drift apart.
export const SLUG_CHANGE_LIMIT = 3;
export const SLUG_CHANGE_WINDOW_DAYS = 30;

// Decision P12 of task 2.4 (founder, 2026-11-10): a link a barbershop left
// stays set aside for it, leading to its new one, for SLUG_SET_ASIDE_DAYS
// days (3 months). From then on any barbershop may take it and it leads
// nowhere. The database frees it (guard_barbershop_slug); slug.test.ts fails
// if the two copies drift apart.
export const SLUG_SET_ASIDE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

// When a link left at `retiredAt` stops being set aside.
export function slugSetAsideUntil(retiredAt: Date): Date {
  return new Date(retiredAt.getTime() + SLUG_SET_ASIDE_DAYS * DAY_MS);
}

// Links left at or before this instant are no longer set aside: what is
// still set aside was left after it.
export function slugSetAsideSince(now: Date): Date {
  return new Date(now.getTime() - SLUG_SET_ASIDE_DAYS * DAY_MS);
}
