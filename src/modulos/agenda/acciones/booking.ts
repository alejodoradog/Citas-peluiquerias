"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fromBogota } from "@/lib/fechas/fechas";
import { readForm, type FormState } from "@/lib/formularios/form-state";
import { routes } from "@/lib/routes";
import { hashLinkToken, newLinkToken } from "@/lib/tokens/link-token";
import { clientIp, hashClientIp } from "@/lib/turnstile/client-ip";
import { TURNSTILE_FIELD } from "@/lib/turnstile/keys";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { toBookingRefusal } from "../datos/booking-errors";
import {
  createPublicBooking,
  loadPublicProfile,
} from "../datos/public-booking";
import { MANAGE_TOKEN_COOKIE } from "../datos/manage-cookie";
import {
  bookingQuery,
  FIRST_AVAILABLE,
  readBookingParams,
} from "../dominio/booking-flow";
import { ipLimitKey } from "../dominio/booking-limits";
import {
  parseCustomerDetails,
  type CustomerDetailsErrorCode,
} from "../dominio/customer-details";

// - services_changed: a chosen service is no longer offered.
// - captcha_failed: Turnstile did not confirm a person (task 3.5).
// - too_many_upcoming, too_many_from_ip: the limits of task 3.5.
// - unknown: the booking could not be made (the network, the database).
export type BookingActionErrorCode =
  | CustomerDetailsErrorCode
  | "services_changed"
  | "captcha_failed"
  | "too_many_upcoming"
  | "too_many_from_ip"
  | "unknown";

export type BookingField = "name" | "email" | "phone";

export type BookingState = FormState<BookingField, BookingActionErrorCode>;

const FIELDS = ["name", "email", "phone"] as const;

// C-06, "Confirmar reserva" (task 3.3). Everything the browser sends is
// untrusted: the selection is read again from the hidden fields as from the
// URL, and book_appointment checks the whole booking in the database. The
// manage token (task 3.4) is created here and only its hash is sent. The
// token goes to C-08 alone, in a short cookie (manage-cookie.ts), so the
// link never travels in a URL the browser keeps.
export async function bookAppointment(
  _previous: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const form = readForm(formData, {
    fields: FIELDS,
    parse: parseCustomerDetails,
  });
  if (!form.valid) return form.state;

  const slug = String(formData.get("slug") ?? "");
  const selection = readBookingParams({
    servicios: formData.getAll("servicios").map(String),
    barbero: String(formData.get("barbero") ?? ""),
    dia: String(formData.get("dia") ?? ""),
    hora: String(formData.get("hora") ?? ""),
  });
  const profile = await loadPublicProfile(slug);
  if (!profile || selection.step !== "datos") {
    return { status: "failed", error: "unknown", values: form.values };
  }

  // Turnstile before anything else reaches the database (task 3.5).
  const ip = await clientIp();
  const human = await verifyTurnstile(
    String(formData.get(TURNSTILE_FIELD) ?? ""),
    ip,
  );
  if (!human) {
    return { status: "failed", error: "captcha_failed", values: form.values };
  }

  const token = newLinkToken();
  const result = await createPublicBooking({
    barbershopId: profile.id,
    barberId: selection.barber === FIRST_AVAILABLE ? null : selection.barber,
    startsAt: fromBogota(selection.date!, selection.time!),
    serviceIds: selection.serviceIds,
    name: form.data.name,
    email: form.data.email,
    phone: form.data.phone,
    manageTokenHash: hashLinkToken(token),
    // The limit counts an IPv6 visitor by its /64 network (task 3.5b).
    clientIpHash: ip ? hashClientIp(ipLimitKey(ip)) : null,
  });

  if (!result.ok) {
    const refusal = toBookingRefusal(result.error);
    if (refusal === "slot_gone") {
      // C-07: back to the times of that day, saying which one was taken.
      redirect(
        routes.bookingFlow(profile.slug) +
          bookingQuery({
            serviceIds: selection.serviceIds,
            barber: selection.barber,
            date: selection.date,
            step: "hora",
            taken: selection.time,
          }),
      );
    }
    if (refusal === "not_accepting") redirect(routes.booking(profile.slug));
    return {
      status: "failed",
      error:
        refusal === "services_changed" ||
        refusal === "too_many_upcoming" ||
        refusal === "too_many_from_ip"
          ? refusal
          : "unknown",
      values: form.values,
    };
  }

  (await cookies()).set(
    MANAGE_TOKEN_COOKIE.name,
    token,
    MANAGE_TOKEN_COOKIE.options(profile.slug),
  );
  // C-08 shows only public data: the services, the barber, the time. The
  // customer's details never travel in the URL.
  redirect(
    routes.bookingConfirmed(profile.slug) +
      bookingQuery({
        serviceIds: selection.serviceIds,
        barber: result.barberId,
        date: selection.date,
        time: selection.time,
      }) +
      (selection.barber === FIRST_AVAILABLE ? "&asignado=1" : ""),
  );
}
