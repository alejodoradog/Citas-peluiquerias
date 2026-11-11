"use server";

import { rememberActiveBarbershop } from "../datos/active-barbershop";
import { requireOwner } from "../guards";

export type SwitchBarbershopResult = "switched" | "refused";

// Más › Tus sedes (task 2.6): the panel moves to another of the owner's
// barbershops. The id comes from the browser, so it counts only if it is one
// of the barbershops the owner's memberships list; getCurrentAccess checks
// the cookie against that same list on every request anyway. The screen then
// loads the panel again in full, so no hidden page keeps the other sede.
export async function switchBarbershop(
  id: unknown,
): Promise<SwitchBarbershopResult> {
  const { barbershops } = await requireOwner();
  const target = barbershops.find((barbershop) => barbershop.id === id);
  if (!target) return "refused";
  await rememberActiveBarbershop(target.id);
  return "switched";
}
