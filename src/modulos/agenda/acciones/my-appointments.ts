"use server";

import { readForm, type FormState } from "@/lib/formularios/form-state";
import { clientIp, hashClientIp } from "@/lib/turnstile/client-ip";
import { TURNSTILE_FIELD } from "@/lib/turnstile/keys";
import { verifyTurnstile } from "@/lib/turnstile/verify";
import { parseWith } from "@/lib/validacion/parse";
import { emailSchema } from "@/lib/validacion/credentials";
import { z } from "zod";
import { requestMyAppointments } from "../datos/my-appointments";
import { loadPublicProfile } from "../datos/public-booking";
import { ipLimitKey } from "../dominio/booking-limits";

// C-19 → C-20, "Mis citas". The answer is always the same, whether the email
// is a customer's or not (decision 0006 de correo, point 10): only Turnstile
// and the IP limit say anything else.
export type MyAppointmentsErrorCode =
  "email_invalid" | "captcha_failed" | "too_many_from_ip" | "unknown";

export type MyAppointmentsState = FormState<"email", MyAppointmentsErrorCode>;

const schema = z.object({ email: emailSchema });

export async function askForMyAppointments(
  _previous: MyAppointmentsState,
  formData: FormData,
): Promise<MyAppointmentsState> {
  const form = readForm(formData, {
    fields: ["email"],
    parse: (input) =>
      parseWith<typeof schema, MyAppointmentsErrorCode>(schema, input),
  });
  if (!form.valid) return form.state;

  const profile = await loadPublicProfile(String(formData.get("slug") ?? ""));
  if (!profile)
    return { status: "failed", error: "unknown", values: form.values };

  const ip = await clientIp();
  const human = await verifyTurnstile(
    String(formData.get(TURNSTILE_FIELD) ?? ""),
    ip,
  );
  if (!human) {
    return { status: "failed", error: "captcha_failed", values: form.values };
  }

  const result = await requestMyAppointments({
    barbershopId: profile.id,
    email: form.data.email,
    clientIpHash: ip ? hashClientIp(ipLimitKey(ip)) : null,
  });
  if (!result.ok) {
    return { status: "failed", error: result.error, values: form.values };
  }
  return { status: "done" };
}
