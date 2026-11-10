import { z } from "zod";
import { parsePesos } from "@/lib/dinero/pesos";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

// Spec, "Disponibilidad": each service lasts 5 to 240 minutes, in steps of 5.
// The database enforces the same rule (services_duration_minutes_check).
export const SERVICE_DURATION = { min: 5, max: 240, step: 5 } as const;

export const DURATION_OPTIONS: readonly number[] = Array.from(
  {
    length:
      (SERVICE_DURATION.max - SERVICE_DURATION.min) / SERVICE_DURATION.step + 1,
  },
  (_, index) => SERVICE_DURATION.min + index * SERVICE_DURATION.step,
);

export const SERVICE_NAME_MAX = 60;

export type ServiceErrorCode =
  | "service_name_required"
  | "service_name_too_long"
  | "service_name_taken"
  | "service_price_invalid"
  | "service_duration_invalid";

// The typical services the wizard suggests (D-10). "Corte + barba" is no
// longer one of them: a booking takes several services and adds them up.
export const SUGGESTED_SERVICES = [
  { name: "Corte", priceCop: 25_000, durationMinutes: 40, offered: true },
  { name: "Barba", priceCop: 15_000, durationMinutes: 20, offered: true },
  { name: "Cejas", priceCop: 8_000, durationMinutes: 10, offered: true },
  { name: "Niños", priceCop: 20_000, durationMinutes: 30, offered: false },
] as const;

export function isValidDuration(minutes: number): boolean {
  return DURATION_OPTIONS.includes(minutes);
}

const serviceFormSchema = z.object({
  name: z
    .string({ error: "service_name_required" })
    .trim()
    .min(1, "service_name_required")
    .max(SERVICE_NAME_MAX, "service_name_too_long"),
  price: z
    .string({ error: "service_price_invalid" })
    .transform((value, ctx) => {
      const price = parsePesos(value);
      if (price === null) {
        ctx.addIssue({ code: "custom", message: "service_price_invalid" });
        return z.NEVER;
      }
      return price;
    }),
  duration: z
    .string({ error: "service_duration_invalid" })
    .transform((value, ctx) => {
      const minutes = Number(value);
      if (!isValidDuration(minutes)) {
        ctx.addIssue({ code: "custom", message: "service_duration_invalid" });
        return z.NEVER;
      }
      return minutes;
    }),
});

export type ServiceForm = z.output<typeof serviceFormSchema>;

// The service form as typed: name, price ("25.000") and duration ("40").
export function parseServiceForm(
  input: unknown,
): ParseResult<ServiceForm, ServiceErrorCode> {
  return parseWith(serviceFormSchema, input);
}

// Names compare without case or surrounding spaces ("Corte" = " corte ").
export function sameServiceName(a: string, b: string): boolean {
  return (
    a.trim().toLocaleLowerCase("es-CO") === b.trim().toLocaleLowerCase("es-CO")
  );
}
