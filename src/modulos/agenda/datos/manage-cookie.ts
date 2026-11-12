import { routes } from "@/lib/routes";

// The manage token travels from "Confirmar reserva" to C-08 in this cookie
// (task 3.4): only the confirmation page of that barbershop receives it,
// scripts cannot read it, and it lasts 30 minutes, enough to reload the
// page. Until the confirmation email (phase 5), C-08 is where the customer
// gets the link.
export const MANAGE_TOKEN_COOKIE = {
  name: "yapoin_cita",
  options: (slug: string) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: routes.bookingConfirmed(slug),
    maxAge: 30 * 60,
  }),
};
