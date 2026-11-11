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
