// Rules of the sedes of an account (task 2.6b).

// Founder (2026-11-10): an account holds at most 4 sedes. The database
// enforces it (create_barbershop, hint barbershop_limit);
// barbershop-rules.test.ts fails if the two copies drift apart.
export const MAX_BARBERSHOPS_PER_ACCOUNT = 4;

export function canAddBarbershop(count: number): boolean {
  return count < MAX_BARBERSHOPS_PER_ACCOUNT;
}

// Founder: a sede can be deleted only while the account keeps another one.
export function canDeleteBarbershop(count: number): boolean {
  return count > 1;
}

// How a name is compared: spaces at the ends and repeated inside do not
// count, nor capitals; accents do (they make another name).
function comparable(name: string): string {
  return name
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-CO");
}

// "Eliminar sede" asks the owner to write the sede's name, so a sede is
// never deleted by a stray tap. The screen enables the button with it and
// the server checks it again.
export function confirmsBarbershopName(typed: unknown, name: string): boolean {
  return typeof typed === "string" && comparable(typed) === comparable(name);
}
