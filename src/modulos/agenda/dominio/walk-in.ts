import { z } from "zod";
import type { ParseResult } from "@/lib/validacion/parse";
import { isId } from "@/modulos/barberias/dominio/service";
import { CUSTOMER_NAME_MAX } from "./customer-details";
import { parseServiceIds } from "./owner-forms";

// Task 7.7: the walk-in appointment ("Cita al momento"), for a customer who
// arrives without a booking (decision D5). The database decides everything
// that matters (migration add_walk_in_appointments): the start, the length
// and the price, and whether it fits. What lives here is what the screen
// shows before asking and how it explains a refusal.

const FIVE_MINUTES_MS = 5 * 60_000;

// When a walk-in made at `now` starts: the minute rounded down to 5, as the
// database does (date_bin of 5 minutes). Only to show it; the database sets
// its own.
export function walkInStart(now: Date): Date {
  return new Date(
    Math.floor(now.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS,
  );
}

export type WalkInService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCop: number;
};

export type WalkInTotals = { count: number; minutes: number; priceCop: number };

// The chosen services, added up. Ids that are not offered count nothing.
export function walkInTotals(
  services: readonly WalkInService[],
  chosen: readonly string[],
): WalkInTotals {
  const picked = services.filter((service) => chosen.includes(service.id));
  return {
    count: picked.length,
    minutes: picked.reduce((sum, service) => sum + service.durationMinutes, 0),
    priceCop: picked.reduce((sum, service) => sum + service.priceCop, 0),
  };
}

export function walkInEnd(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

export type WalkInField = "profesional" | "nombre";
export type WalkInFormCode =
  "barber_not_found" | "customer_name_invalid" | "services_required";

export type WalkInRequest = {
  serviceIds: string[];
  // Null: the customer stays as "Cliente al momento".
  customerName: string | null;
};

// The services (1 to 5 distinct ids) and an optional name, as the database
// checks them again: up to 100 characters, no control characters.
export function parseWalkInForm(input: {
  servicios: readonly unknown[];
  nombre: unknown;
}): ParseResult<WalkInRequest, WalkInFormCode> {
  const name = typeof input.nombre === "string" ? input.nombre.trim() : "";
  if (
    [...name].length > CUSTOMER_NAME_MAX ||
     
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    return { success: false, errors: { nombre: "customer_name_invalid" } };
  }
  const serviceIds = parseServiceIds(input.servicios);
  if (!serviceIds) {
    return { success: false, errors: { servicios: "services_required" } };
  }
  return {
    success: true,
    data: { serviceIds, customerName: name === "" ? null : name },
  };
}

// The owner's form adds the professional.
export function parseWalkInBarber(
  value: unknown,
): ParseResult<string, WalkInFormCode> {
  return isId(value)
    ? { success: true, data: value }
    : { success: false, errors: { profesional: "barber_not_found" } };
}

// Why a walk-in does not fit now: the detail of the database's walk_in_clash.
// - appointment: an appointment of the professional (it may have started);
// - block: a block of their own;
// - closure: the establishment closes (a block of the whole establishment);
// - closing: their hours end;
// - closed: they do not work at this time (or it is a closed holiday).
export type WalkInClashKind =
  "appointment" | "block" | "closure" | "closing" | "closed";

export type WalkInClash = {
  kind: WalkInClashKind;
  // When what it clashes with starts (or the hours end). Null when closed.
  at: Date | null;
  freeMinutes: number;
  neededMinutes: number;
};

const clashSchema = z.object({
  kind: z.enum(["appointment", "block", "closure", "closing", "closed"]),
  at: z.iso.datetime({ offset: true }).nullable(),
  freeMinutes: z.number().int().min(0),
  neededMinutes: z.number().int().min(1),
});

// The detail of the error, or null when it is not one (the screen then says
// the general message).
export function parseWalkInClash(
  detail: string | null | undefined,
): WalkInClash | null {
  if (!detail) return null;
  let json: unknown;
  try {
    json = JSON.parse(detail);
  } catch {
    return null;
  }
  const parsed = clashSchema.safeParse(json);
  if (!parsed.success) return null;
  const { kind, at, freeMinutes, neededMinutes } = parsed.data;
  if (kind !== "closed" && at === null) return null;
  return {
    kind,
    at: kind === "closed" || at === null ? null : new Date(at),
    freeMinutes,
    neededMinutes,
  };
}
