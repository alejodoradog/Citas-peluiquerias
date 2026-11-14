// Task 5.3: the emails of the appointments, read when they are sent (rule Q5
// of task 5.1), on the frame of E-07 that task 5.2 drew for the
// subscription's emails (render.ts):
// - appointment_reminder: the customer's only email for an appointment
//   (founder's decision of 2026-11-14), 24 h before, with "Confirmo",
//   "Cancelar", the calendar and the link to see or change it;
// - appointment_cancelled and appointment_rescheduled: when the barbershop
//   cancelled or moved it;
// - barber_new_booking and barber_booking_cancelled: the barber's notices,
//   when they asked for them.
// An email whose appointment changed since it was queued is cancelled
// ("outdated"): the newer change queued its own. No imports but types, so
// Deno and Vitest share this file.
import type { Email } from "./render.ts";
import type { QueuedMessage } from "./run-queue.ts";

// The link of an email, /c/<token>, like the one of C-08 (task 3.4). The
// payload never keeps it (rule Q5 of task 5.1): the token is derived from
// the email's id with the function's secret, so a retry of the same email
// gives the same link, and only its hash reaches the database
// (issue_appointment_link). The shape is that of src/lib/tokens/link-token.ts:
// 32 bytes in base64url, 43 characters, and its SHA-256 in hex.
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// The token of one email: HMAC-SHA256 of its id, under a label of its own so
// the secret of the function never signs anything else the same way.
export async function emailLinkToken(
  secret: string,
  notificationId: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`appointment-link:${notificationId}`),
  );
  return base64url(new Uint8Array(signature));
}

// What the database keeps: the SHA-256 of the token, in hex
// (hashLinkToken in src/lib/tokens/link-token.ts).
export async function linkTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const APPOINTMENT_EMAILS = new Set([
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
  "barber_new_booking",
  "barber_booking_cancelled",
]);

// The words of these emails (the exception of render.ts: Deno does not
// bundle src/ui/textos.ts).
export const textos = {
  marca: "Yapoin",
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  pie: (lugar: string) => `Recibes este correo por una cita en ${lugar}.`,
  cuando: (dia: string, hora: string) => `${dia} a las ${hora}`,
  servicios: (servicios: string, barbero: string) =>
    `${servicios} con ${barbero}.`,
  direccion: (direccion: string) => `Dirección: ${direccion}.`,
  recordatorio: {
    asunto: (barberia: string, cuando: string) =>
      `Tu cita en ${barberia}: ${cuando}`,
    cuerpo: (barberia: string, cuando: string) =>
      `Te esperamos el ${cuando} en ${barberia}.`,
    pregunta: "¿Vas a llegar? Cuéntale a la barbería con un toque.",
    confirmo: "Sí, ahí estaré",
    cancelar: "No puedo ir: cancelar",
    calendario: "Agregar a mi calendario",
    verCita: "Ver o cambiar mi cita",
    plazo: (horas: number) =>
      `Puedes cambiarla o cancelarla hasta ${horas === 1 ? "1 hora" : `${horas} horas`} antes.`,
  },
  cancelada: {
    asunto: (barberia: string) => `${barberia} canceló tu cita`,
    cuerpo: (barberia: string, cuando: string, barbero: string) =>
      `${barberia} canceló tu cita del ${cuando} con ${barbero}.`,
    otra: "Si quieres, reserva otra hora en su página.",
    reservar: "Reservar otra hora",
  },
  reprogramada: {
    asunto: (barberia: string) => `${barberia} cambió la hora de tu cita`,
    cuerpo: (antes: string, ahora: string, barbero: string) =>
      `Tu cita pasó del ${antes} al ${ahora}, con ${barbero}.`,
    noSirve: (horas: number) =>
      `Si esa hora no te sirve, puedes cambiarla o cancelarla hasta ${horas === 1 ? "1 hora" : `${horas} horas`} antes.`,
    verCita: "Ver mi cita",
  },
  barbero: {
    nueva: {
      asunto: (cliente: string, cuando: string) =>
        `Nueva cita: ${cliente}, ${cuando}`,
      cuerpo: (cliente: string, servicios: string, cuando: string) =>
        `${cliente} tiene cita contigo el ${cuando}: ${servicios}.`,
    },
    cancelada: {
      asunto: (cliente: string, cuando: string) =>
        `Cancelaron la cita de ${cliente}, ${cuando}`,
      cuerpo: (cliente: string, cuando: string) =>
        `La cita de ${cliente} del ${cuando} quedó cancelada. Ese espacio vuelve a estar libre.`,
    },
  },
  calendarioTitulo: (barberia: string) => `Cita en ${barberia}`,
} as const;

const t = textos;

export type AppointmentRecord = {
  status: string;
  startsAt: string;
  endsAt: string;
  barberName: string;
  serviceNames: string[];
  customerFirstName: string;
  barbershop: {
    name: string;
    slug: string;
    address: string | null;
    locality: string | null;
    cancellationNoticeHours: number;
  };
};

// The database, as a small interface (index.ts passes the service client;
// the tests, a fake). Every read is filtered by the barbershop of the
// message, so a message never shows another barbershop's appointment.
export type AppointmentDb = {
  appointment(
    barbershopId: string,
    appointmentId: string,
  ): Promise<AppointmentRecord | null>;
  issueLink(
    barbershopId: string,
    appointmentId: string,
    tokenHash: string,
  ): Promise<void>;
};

export type AppointmentEnv = { siteUrl: string; linkSecret: string };

// "sábado 15 de noviembre" and "3:00 p. m.", in Bogotá.
export function dayLine(iso: string): string {
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("weekday")} ${part("day")} de ${part("month")}`;
}

export function timeLine(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s+/g, " ");
}

function when(iso: string): string {
  return t.cuando(dayLine(iso), timeLine(iso));
}

// "Agregar a mi calendario": a Google Calendar event, as on C-08 and C-09
// (calendarUrl in src/app/[slug]/booking-ui.tsx).
export function calendarUrl(
  title: string,
  start: string,
  end: string,
  place: string,
): string {
  const stamp = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: place,
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

type Button = { label: string; href: string; tone: "primary" | "secondary" };

// The frame of E-07 with its buttons: the brand, the title, the paragraphs,
// the buttons and a footer that names the barbershop and its address.
function frame(
  name: string | null,
  subject: string,
  paragraphs: string[],
  buttons: Button[],
  place: string,
): Email {
  const lines = [t.saludo(name), ...paragraphs];
  const footer = t.pie(place);
  const button = ({ label, href, tone }: Button) =>
    tone === "primary"
      ? `<p style="margin:0 0 12px"><a href="${escapeHtml(href)}" style="display:block;text-align:center;background:#1e7f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">${escapeHtml(label)}</a></p>`
      : `<p style="margin:0 0 12px"><a href="${escapeHtml(href)}" style="display:block;text-align:center;background:#ffffff;color:#145a63;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:14px;border:1px solid #c9d6d3">${escapeHtml(label)}</a></p>`;
  const html = [
    '<!doctype html><html lang="es-CO"><body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#16211f">',
    '<div style="max-width:480px;margin:0 auto;padding:24px 20px">',
    `<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#145a63">${escapeHtml(t.marca)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>`,
    ...lines.map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${escapeHtml(line)}</p>`,
    ),
    buttons.length > 0 ? '<div style="margin:22px 0">' : "",
    ...buttons.map(button),
    buttons.length > 0 ? "</div>" : "",
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4c5c58">${escapeHtml(footer)}</p>`,
    "</div></body></html>",
  ].join("");
  const text = [
    ...lines,
    ...buttons.map(({ label, href }) => `${label}: ${href}`),
    "",
    footer,
  ].join("\n\n");
  return { subject, html, text };
}

export type AppointmentEmailData = {
  appointment: AppointmentRecord;
  // The appointment's link for this email (/c/<token>), when it carries one.
  manageUrl: string | null;
  // The start before the barbershop moved it (appointment_rescheduled).
  oldStartsAt: string | null;
  siteUrl: string;
};

// The email of one message, from what was read when it was sent.
export function renderAppointmentEmail(
  type: string,
  data: AppointmentEmailData,
): Email | null {
  const { appointment: a, manageUrl } = data;
  const shop = a.barbershop;
  const address = [shop.address, shop.locality].filter(Boolean).join(", ");
  const place = address ? `${shop.name}, ${address}` : shop.name;
  const services = a.serviceNames.join(" + ");
  const start = when(a.startsAt);
  const site = data.siteUrl.replace(/\/$/, "");

  switch (type) {
    case "appointment_reminder": {
      if (!manageUrl) return null;
      return frame(
        a.customerFirstName,
        t.recordatorio.asunto(shop.name, start),
        [
          t.recordatorio.cuerpo(shop.name, start),
          t.servicios(services, a.barberName),
          ...(address ? [t.direccion(address)] : []),
          t.recordatorio.pregunta,
          t.recordatorio.plazo(shop.cancellationNoticeHours),
        ],
        [
          {
            label: t.recordatorio.confirmo,
            href: `${manageUrl}?confirmo=1`,
            tone: "primary",
          },
          {
            label: t.recordatorio.cancelar,
            href: `${manageUrl}?cancelar=1`,
            tone: "secondary",
          },
          {
            label: t.recordatorio.calendario,
            href: calendarUrl(
              t.calendarioTitulo(shop.name),
              a.startsAt,
              a.endsAt,
              place,
            ),
            tone: "secondary",
          },
          { label: t.recordatorio.verCita, href: manageUrl, tone: "secondary" },
        ],
        place,
      );
    }
    case "appointment_cancelled":
      return frame(
        a.customerFirstName,
        t.cancelada.asunto(shop.name),
        [t.cancelada.cuerpo(shop.name, start, a.barberName), t.cancelada.otra],
        [
          {
            label: t.cancelada.reservar,
            href: `${site}/${shop.slug}`,
            tone: "primary",
          },
        ],
        place,
      );
    case "appointment_rescheduled":
      if (!manageUrl || !data.oldStartsAt) return null;
      return frame(
        a.customerFirstName,
        t.reprogramada.asunto(shop.name),
        [
          t.reprogramada.cuerpo(when(data.oldStartsAt), start, a.barberName),
          ...(address ? [t.direccion(address)] : []),
          t.reprogramada.noSirve(shop.cancellationNoticeHours),
        ],
        [{ label: t.reprogramada.verCita, href: manageUrl, tone: "primary" }],
        place,
      );
    case "barber_new_booking":
      return frame(
        a.barberName,
        t.barbero.nueva.asunto(a.customerFirstName, start),
        [t.barbero.nueva.cuerpo(a.customerFirstName, services, start)],
        [],
        place,
      );
    case "barber_booking_cancelled":
      return frame(
        a.barberName,
        t.barbero.cancelada.asunto(a.customerFirstName, start),
        [t.barbero.cancelada.cuerpo(a.customerFirstName, start)],
        [],
        place,
      );
    default:
      return null;
  }
}

const CANCELLED = new Set(["cancelled_by_customer", "cancelled_by_barbershop"]);

function sameInstant(a: unknown, b: string): boolean {
  return typeof a === "string" && Date.parse(a) === Date.parse(b);
}

// Why an email no longer applies, or null when it still does: the
// appointment was cancelled, moved again or already started.
export function outdatedReason(
  type: string,
  payload: Record<string, unknown>,
  appointment: AppointmentRecord,
  now: number,
): string | null {
  switch (type) {
    case "appointment_reminder":
    case "appointment_rescheduled":
      if (appointment.status !== "confirmed") return "outdated";
      if (!sameInstant(payload.starts_at, appointment.startsAt))
        return "outdated";
      return Date.parse(appointment.startsAt) <= now ? "outdated" : null;
    case "barber_new_booking":
      return appointment.status === "confirmed" ? null : "outdated";
    case "appointment_cancelled":
      return appointment.status === "cancelled_by_barbershop"
        ? null
        : "outdated";
    case "barber_booking_cancelled":
      return CANCELLED.has(appointment.status) ? null : "outdated";
    default:
      return null;
  }
}

const LINKED = new Set(["appointment_reminder", "appointment_rescheduled"]);

// What to send for one appointment's message, or why not: no appointment
// any more, or outdated. The link of the email is issued here, before it is
// sent, so the database knows its hash when the customer taps it.
export async function composeAppointmentEmail(
  message: QueuedMessage,
  db: AppointmentDb,
  env: AppointmentEnv,
  now: number = Date.now(),
): Promise<Email | { cancel: string }> {
  if (!message.appointmentId) return { cancel: "no_appointment" };
  const appointment = await db.appointment(
    message.barbershopId,
    message.appointmentId,
  );
  if (!appointment) return { cancel: "no_appointment" };
  const outdated = outdatedReason(
    message.type,
    message.payload,
    appointment,
    now,
  );
  if (outdated) return { cancel: outdated };

  let manageUrl: string | null = null;
  if (LINKED.has(message.type)) {
    const token = await emailLinkToken(env.linkSecret, message.id);
    await db.issueLink(
      message.barbershopId,
      message.appointmentId,
      await linkTokenHash(token),
    );
    manageUrl = `${env.siteUrl.replace(/\/$/, "")}/c/${token}`;
  }
  const oldStartsAt =
    typeof message.payload.old_starts_at === "string"
      ? message.payload.old_starts_at
      : null;
  return (
    renderAppointmentEmail(message.type, {
      appointment,
      manageUrl,
      oldStartsAt,
      siteUrl: env.siteUrl,
    }) ?? { cancel: "no_template" }
  );
}
