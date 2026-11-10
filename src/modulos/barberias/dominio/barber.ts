import { z } from "zod";
import { emailSchema } from "@/lib/validacion/credentials";
import { parseWith, type ParseResult } from "@/lib/validacion/parse";

export const BARBER_NAME_MAX = 60;

export type BarberErrorCode =
  | "barber_name_required"
  | "barber_name_too_long"
  | "barber_services_required"
  | "email_invalid";

const barberFormSchema = z.object({
  displayName: z
    .string({ error: "barber_name_required" })
    .trim()
    .min(1, "barber_name_required")
    .max(BARBER_NAME_MAX, "barber_name_too_long"),
  // Optional: an empty field means no email.
  email: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(emailSchema.nullable()),
  serviceKeys: z.array(z.string()).min(1, "barber_services_required"),
});

export type BarberForm = z.output<typeof barberFormSchema>;

export function parseBarberForm(
  input: unknown,
): ParseResult<BarberForm, BarberErrorCode> {
  return parseWith(barberFormSchema, input);
}

// Más › Barberos (D-54) ----------------------------------------------------------

// - notifications_need_email: email notices need an email to go to (the
//   database checks the same, barbers_notifications_need_email).
export type TeamBarberErrorCode = BarberErrorCode | "notifications_need_email";

const teamBarberFormSchema = z
  .object({
    displayName: barberFormSchema.shape.displayName,
    email: barberFormSchema.shape.email,
    // A checkbox: "on" when checked, absent (here "") when not.
    emailNotifications: z.string().transform((value) => value === "on"),
  })
  .superRefine((form, ctx) => {
    if (form.emailNotifications && form.email === null) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "notifications_need_email",
      });
    }
  });

export type TeamBarberForm = z.output<typeof teamBarberFormSchema>;

// The barber form of D-54 as typed: name, optional email and the email
// notices switch, which needs an email.
export function parseTeamBarberForm(
  input: unknown,
): ParseResult<TeamBarberForm, TeamBarberErrorCode> {
  return parseWith(teamBarberFormSchema, input);
}

// A barber does at least one service, as in the wizard, as long as the
// barbershop has any active service to give them.
export function missingServices(
  chosen: readonly string[],
  activeServices: number,
): boolean {
  return activeServices > 0 && chosen.length === 0;
}

type ListedBarber = {
  display_name: string;
  active: boolean;
  sort_order: number;
  deactivated_at: string | null;
};

// The team of D-53: the active barbers in the team's order (then by name),
// then the inactive ones, the most recent departure first.
export function splitBarbers<B extends ListedBarber>(
  barbers: readonly B[],
): { active: B[]; inactive: B[] } {
  const byName = (a: B, b: B) =>
    a.display_name.localeCompare(b.display_name, "es-CO", {
      sensitivity: "base",
    });
  return {
    active: barbers
      .filter((barber) => barber.active)
      .sort((a, b) => a.sort_order - b.sort_order || byName(a, b)),
    inactive: barbers
      .filter((barber) => !barber.active)
      .sort(
        (a, b) =>
          (b.deactivated_at ?? "").localeCompare(a.deactivated_at ?? "") ||
          byName(a, b),
      ),
  };
}

// Where a new barber goes in the team: after everyone else.
export function nextSortOrder(orders: readonly number[]): number {
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}
