// Which of the owner's barbershops (sedes) the panel shows (task 2.6,
// decision 0006, "Cambiar de sede en el panel"). The choice travels in a
// cookie, which the browser can change at will: it only ever picks among the
// barbershops the owner's memberships list, never adds one.

// The cookie that keeps the active barbershop's id between requests.
export const ACTIVE_BARBERSHOP_COOKIE = "yapoin_sede";

// A year: the owner keeps working on the sede they picked until they pick
// another one.
export const ACTIVE_BARBERSHOP_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type Ordered = { id: string; createdAt: string };

// Oldest first, the order of the switcher and of create_barbershop's company
// trial. Two barbershops created at the same instant fall back to the id,
// as the database orders them.
export function sortByCreation<B extends Ordered>(barbershops: readonly B[]) {
  return [...barbershops].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

// The barbershop the cookie names when it is one of the owner's; otherwise
// the oldest one. Undefined only when the owner has none.
export function pickActiveBarbershop<B extends { id: string }>(
  barbershops: readonly B[],
  chosenId: string | undefined,
): B | undefined {
  return (
    barbershops.find((barbershop) => barbershop.id === chosenId) ??
    barbershops[0]
  );
}
