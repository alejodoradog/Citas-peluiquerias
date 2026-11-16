import type { BarberRefusal } from "@/modulos/agenda/datos/barber-errors";

// The ?aviso= a mark or a removal leaves when it could not be saved
// (acciones/barber.ts). Anything else in the query is ignored.
const SHOWN: ReadonlySet<string> = new Set<BarberRefusal>([
  "read_only",
  "not_yours",
  "not_confirmed",
  "too_early",
  "unknown",
]);

export function refusalOf(
  value: string | string[] | undefined,
): BarberRefusal | null {
  return typeof value === "string" && SHOWN.has(value)
    ? (value as BarberRefusal)
    : null;
}
