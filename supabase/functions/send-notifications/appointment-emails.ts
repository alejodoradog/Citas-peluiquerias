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
// payload never keeps it (rule Q5 of task 5.1): a new random token is made
// when the email is sent, and only its hash reaches the database
// (issue_appointment_link). A retry makes another one; if the first email
// left, Resend answers the retry as already sent (idempotency key, task 5.2)
// and the first link keeps working. The shape is that of
// src/lib/tokens/link-token.ts: 32 random bytes in base64url, 43 characters,
// and its SHA-256 in hex.

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function newLinkToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
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
    pregunta: "¿Vas a llegar? Cuéntale al establecimiento con un toque.",
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
      // Task 7.5: how long it takes and what it adds up to.
      duracion: (duracion: string) => `Duración: ${duracion}.`,
      detalle: (duracion: string, total: string) =>
        `Duración: ${duracion}. Total: ${total}.`,
      whatsapp: (cliente: string) => `Escribirle a ${cliente} por WhatsApp`,
    },
    cancelada: {
      asunto: (cliente: string, cuando: string) =>
        `Cancelaron la cita de ${cliente}, ${cuando}`,
      cuerpo: (cliente: string, cuando: string) =>
        `La cita de ${cliente} del ${cuando} quedó cancelada. Ese espacio vuelve a estar libre.`,
    },
  },
  calendarioTitulo: (barberia: string) => `Cita en ${barberia}`,
  unCliente: "Un cliente",
} as const;

const t = textos;

export type AppointmentRecord = {
  status: string;
  startsAt: string;
  endsAt: string;
  barberName: string;
  // The email of the professional who has the appointment now. Their notice
  // is sent only to it (task 7.5): the queue chose the recipient earlier, and
  // the appointment may have moved to someone else since.
  barberEmail: string | null;
  serviceNames: string[];
  customerFirstName: string;
  // Task 7.5, for the professional's notice only: the customer's mobile as
  // the barbershop keeps it (E.164), and what the services add up to.
  customerPhone: string | null;
  totalCop: number | null;
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

export type AppointmentEnv = { siteUrl: string };

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

// A name that a mail client would turn into a link (the database refuses
// new ones, private.has_link; this guards the old rows): the email then
// greets without it.
const LINKISH =
  /([:\uff1a]\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|me|ly|link|info|biz|xyz|app|site|online|store|shop|top|click|gg|to|cc|ws|tk|ru|cn)\b)/i;

export function plainName(name: string | null): string | null {
  return name && !LINKISH.test(name) ? name : null;
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

// The chat with a Colombian mobile, or null: nothing but its own digits ever
// reaches the link (task 7.5).
export function whatsappUrl(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return /^573\d{9}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

// "45 min", "1 h" or "1 h 30 min", from the two instants.
function duration(startsAt: string, endsAt: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Whole pesos with the thousands' dot, as the app writes them: "$28.000".
function pesos(value: number): string {
  return `$${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

// The frame of E-07 with its buttons: the brand, the title, the paragraphs,
// the buttons and a footer that names the barbershop and its address.
function frame(
  name: string | null,
  subject: string,
  paragraphs: string[],
  buttons: Button[],
  place: string,
): Email {
  const lines = [t.saludo(plainName(name)), ...paragraphs];
  const footer = t.pie(place);
  // One line, whatever was written: no control character reaches a header.
  const title = subject.replace(/[\p{Cc}]+/gu, " ");
  const button = ({ label, href, tone }: Button) =>
    tone === "primary"
      ? `<p style="margin:0 0 12px"><a href="${escapeHtml(href)}" style="display:block;text-align:center;background:#1e7f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">${escapeHtml(label)}</a></p>`
      : `<p style="margin:0 0 12px"><a href="${escapeHtml(href)}" style="display:block;text-align:center;background:#ffffff;color:#145a63;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:14px;border:1px solid #c9d6d3">${escapeHtml(label)}</a></p>`;
  const html = [
    '<!doctype html><html lang="es-CO"><body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#16211f">',
    '<div style="max-width:480px;margin:0 auto;padding:24px 20px">',
    `<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#145a63">${escapeHtml(t.marca)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(title)}</h1>`,
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
  return { subject: title, html, text };
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
  const customer = plainName(a.customerFirstName) ?? t.unCliente;
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
    case "barber_new_booking": {
      const lasts = duration(a.startsAt, a.endsAt);
      const chat = whatsappUrl(a.customerPhone);
      return frame(
        a.barberName,
        t.barbero.nueva.asunto(customer, start),
        [
          t.barbero.nueva.cuerpo(customer, services, start),
          a.totalCop === null
            ? t.barbero.nueva.duracion(lasts)
            : t.barbero.nueva.detalle(lasts, pesos(a.totalCop)),
        ],
        chat
          ? [
              {
                label: t.barbero.nueva.whatsapp(customer),
                href: chat,
                tone: "primary",
              },
            ]
          : [],
        place,
      );
    }
    case "barber_booking_cancelled":
      return frame(
        a.barberName,
        t.barbero.cancelada.asunto(customer, start),
        [t.barbero.cancelada.cuerpo(customer, start)],
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

function sameEmail(a: string | null, b: string | null): boolean {
  return (
    a !== null &&
    b !== null &&
    a.trim().toLowerCase() === b.trim().toLowerCase()
  );
}

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
  // A professional's notice carries the customer's mobile: it never goes to
  // a professional who no longer has the appointment.
  if (
    message.type.startsWith("barber_") &&
    !sameEmail(message.recipient, appointment.barberEmail)
  ) {
    return { cancel: "outdated" };
  }

  let manageUrl: string | null = null;
  if (LINKED.has(message.type)) {
    const token = newLinkToken();
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

// "Mis citas" (C-19 to C-21): the customer asked for the link to their
// upcoming appointments in a barbershop. The payload carries only the
// customer's id; the link (/<slug>/mis-citas/<token>) is made when the email
// is sent and lives 24 hours (issue_customer_link).
export const MY_APPOINTMENTS_EMAIL = "customer_appointments";

export const misCitas = {
  asunto: (barberia: string) => `Tus citas en ${barberia}`,
  cuerpo: (barberia: string) =>
    `Aquí tienes el link para ver tus próximas citas en ${barberia}. Desde ahí puedes confirmarlas, cambiarlas o cancelarlas.`,
  vence: "El link sirve por 24 horas.",
  noFuiste: "Si no lo pediste tú, ignora este correo: nadie más lo recibe.",
  boton: "Ver mis citas",
} as const;

export type CustomerRecord = {
  firstName: string;
  hasUpcoming: boolean;
  barbershop: {
    name: string;
    slug: string;
    address: string | null;
    locality: string | null;
  };
};

export type CustomerDb = {
  customer(
    barbershopId: string,
    customerId: string,
  ): Promise<CustomerRecord | null>;
  issueCustomerLink(
    barbershopId: string,
    customerId: string,
    tokenHash: string,
  ): Promise<void>;
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function composeMyAppointmentsEmail(
  message: QueuedMessage,
  db: CustomerDb,
  env: AppointmentEnv,
): Promise<Email | { cancel: string }> {
  const customerId = message.payload.customer_id;
  if (typeof customerId !== "string" || !ID.test(customerId)) {
    return { cancel: "no_customer" };
  }
  const customer = await db.customer(message.barbershopId, customerId);
  if (!customer) return { cancel: "no_customer" };
  // Nothing upcoming any more (it was cancelled or passed): nothing to show.
  if (!customer.hasUpcoming) return { cancel: "outdated" };

  const token = newLinkToken();
  await db.issueCustomerLink(
    message.barbershopId,
    customerId,
    await linkTokenHash(token),
  );
  const shop = customer.barbershop;
  const site = env.siteUrl.replace(/\/$/, "");
  const address = [shop.address, shop.locality].filter(Boolean).join(", ");
  return frame(
    customer.firstName,
    misCitas.asunto(shop.name),
    [misCitas.cuerpo(shop.name), misCitas.vence, misCitas.noFuiste],
    [
      {
        label: misCitas.boton,
        href: `${site}/${shop.slug}/mis-citas/${token}`,
        tone: "primary",
      },
    ],
    address ? `${shop.name}, ${address}` : shop.name,
  );
}
