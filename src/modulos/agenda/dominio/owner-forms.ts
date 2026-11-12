import { fromBogota, isBogotaDate } from "@/lib/fechas/fechas";
import { emailSchema } from "@/lib/validacion/credentials";
import type { ParseResult } from "@/lib/validacion/parse";
import { isId } from "@/modulos/barberias/dominio/service";
import { normalizeColombianMobile } from "@/modulos/barberias/dominio/phone";
import { CUSTOMER_NAME_MAX } from "./customer-details";

// Task 4.2: the forms of D-37 and D-38, as the database checks them again
// (create_manual_appointment, reschedule_appointment). The error codes are
// the hints of the database, so one copy in src/ui/textos.ts serves both.

const QUARTER_TIME = /^([01]\d|2[0-3]):(00|15|30|45)$/;
const MAX_SERVICES = 5;

export type SlotField = "barbero" | "dia" | "hora";
export type SlotCode = "barber_not_found" | "slot_invalid";

export type SlotRequest = { barberId: string; start: Date };

// The barber, the day (YYYY-MM-DD) and the time (HH:MM, a quarter hour of
// Bogotá) of D-37 and D-38.
export function parseSlot(
  input: Record<SlotField, string>,
): ParseResult<SlotRequest, SlotCode> {
  if (!isId(input.barbero)) {
    return { success: false, errors: { barbero: "barber_not_found" } };
  }
  if (!isBogotaDate(input.dia) || !QUARTER_TIME.test(input.hora)) {
    return { success: false, errors: { hora: "slot_invalid" } };
  }
  return {
    success: true,
    data: { barberId: input.barbero, start: fromBogota(input.dia, input.hora) },
  };
}

// The services chosen in D-38 and in the sheet of D-34: 1 to 5 distinct ids.
export function parseServiceIds(values: readonly unknown[]): string[] | null {
  const ids = values.filter(
    (value): value is string => typeof value === "string",
  );
  if (ids.length !== values.length) return null;
  if (ids.length < 1 || ids.length > MAX_SERVICES) return null;
  if (!ids.every(isId) || new Set(ids).size !== ids.length) return null;
  return ids;
}

export type CustomerField = "cliente" | "nombre" | "correo" | "celular";
export type CustomerCode =
  | "customer_not_found"
  | "customer_name_invalid"
  | "customer_email_invalid"
  | "customer_phone_invalid";

export type ManualCustomer =
  { id: string } | { name: string; email: string | null; phone: string | null };

// D-38: a chosen customer (its id), or a new one with a name and, if given,
// an email and a Colombian mobile.
export function parseManualCustomer(
  input: Record<CustomerField, string>,
): ParseResult<ManualCustomer, CustomerCode> {
  if (input.cliente !== "") {
    return isId(input.cliente)
      ? { success: true, data: { id: input.cliente } }
      : { success: false, errors: { cliente: "customer_not_found" } };
  }
  const errors: Partial<Record<CustomerField, CustomerCode>> = {};
  const name = input.nombre.trim();
  if (
    name.length < 1 ||
    name.length > CUSTOMER_NAME_MAX ||
    /\p{Cc}/u.test(name)
  ) {
    errors.nombre = "customer_name_invalid";
  }
  const email = input.correo.trim().toLowerCase();
  if (email !== "" && !emailSchema.safeParse(email).success) errors.correo = "customer_email_invalid";
  const rawPhone = input.celular.trim();
  const phone = rawPhone === "" ? null : normalizeColombianMobile(rawPhone);
  if (rawPhone !== "" && !phone) errors.celular = "customer_phone_invalid";
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: { name, email: email === "" ? null : email, phone },
  };
}
