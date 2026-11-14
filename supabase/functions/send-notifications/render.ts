// Task 5.2: an email of the queue from the data read when it is sent (rule
// Q5 of task 5.1): subject, HTML and plain text. The common frame follows
// E-07 (docs/diseno/E07-Link-barbero.dc.html): the brand, the body, a button
// and a footer that names the barbershop. Every value is escaped. Task 5.3
// adds the appointments' templates on this same frame. No imports, so Deno
// and Vitest share this file.

// The words of the emails, in Spanish of Colombia. They live here because
// src/ui/textos.ts imports modules of the app, which Deno does not bundle (an
// exception noted in docs/tareas/5.2-envio-resend.md).
export const textos = {
  marca: "Yapoin",
  // The wordmark of the header: "Ya" in ink and "poin" in the brand color,
  // and the product line (Yapoin Citas, as the Auth emails).
  marcaInicio: "Ya",
  marcaFin: "poin",
  producto: "Citas",
  saludo: (nombre: string | null) => (nombre ? `Hola, ${nombre}.` : "Hola."),
  abrirPanel: "Abrir mi panel",
  pie: (barberia: string) =>
    `Recibes este correo porque ${barberia} usa Yapoin para sus reservas.`,
  // How to pay, once the founder fills the function's variables (decision
  // E5); until then, a promise to send them.
  pago: {
    con: (valor: string, opciones: string, correo: string) =>
      `Paga ${valor} por ${opciones} y envía el comprobante a ${correo}.`,
    opcionBreB: (llave: string) => `llave Bre-B ${llave}`,
    opcionNequi: (numero: string) => `Nequi ${numero}`,
    o: " o ",
    sinDatos: (valor: string) =>
      `El valor es ${valor} al mes. Te enviaremos los datos de pago por correo.`,
  },
  suscripcion: {
    vence: {
      asuntoPrueba: (fecha: string) => `Tu prueba gratis vence el ${fecha}`,
      asuntoMes: (fecha: string) => `Tu mes en Yapoin vence el ${fecha}`,
      cuerpoPrueba: (barberia: string, fecha: string) =>
        `La prueba gratis de ${barberia} vence el ${fecha}. Para que siga recibiendo reservas, renueva tu plan.`,
      cuerpoMes: (barberia: string, fecha: string) =>
        `El mes de ${barberia} vence el ${fecha}. Para que siga recibiendo reservas, renueva tu plan.`,
    },
    vencida: {
      asunto: (fecha: string) => `Tu barbería venció el ${fecha}`,
      cuerpo: (barberia: string, gracia: string) =>
        `${barberia} sigue recibiendo reservas hasta el ${gracia}. Después, la página deja de recibir reservas nuevas y el panel queda en solo lectura.`,
    },
    pausada: {
      asunto: "Tu barbería está pausada",
      cuerpo: (barberia: string) =>
        `La página de ${barberia} no recibe reservas nuevas y tu agenda es solo de lectura. Las citas tomadas siguen en pie. Al registrar tu pago, todo vuelve a funcionar al instante.`,
    },
    pago: {
      asunto: "Recibimos tu pago",
      cuerpo: (valor: string, barberia: string, fecha: string) =>
        `Registramos tu pago de ${valor}. ${barberia} queda activa hasta el ${fecha}.`,
    },
  },
} as const;

const t = textos;

export type EmailData = {
  barbershop: { name: string; slug: string };
  ownerName: string | null;
  subscription: {
    status: "trial" | "active" | "suspended";
    expiresOn: string;
    planPriceCop: number | null;
  };
  // The payment of subscription_payment_registered.
  payment: { amountCop: number } | null;
  // How to pay (decision E5): the function's variables, or null.
  payInfo: { breB: string | null; nequi: string | null; email: string | null };
  siteUrl: string;
};

export type Email = { subject: string; html: string; text: string };

export const GRACE_DAYS = 5;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "24 de noviembre de 2026", read at noon in Bogotá so it is that day.
export function longDate(date: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T17:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

// "$25.000", as the app writes prices.
export function pesos(value: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;
}

function payLine(data: EmailData): string | null {
  const price = data.subscription.planPriceCop;
  if (price === null) return null;
  const { breB, nequi, email } = data.payInfo;
  const options = [
    breB ? t.pago.opcionBreB(breB) : null,
    nequi ? t.pago.opcionNequi(nequi) : null,
  ].filter((option): option is string => option !== null);
  return options.length > 0 && email
    ? t.pago.con(pesos(price), options.join(t.pago.o), email)
    : t.pago.sinDatos(pesos(price));
}

function frame(data: EmailData, subject: string, paragraphs: string[]): Email {
  const site = data.siteUrl.replace(/\/$/, "");
  const panel = `${site}/panel`;
  const lines = [t.saludo(data.ownerName), ...paragraphs];
  const footer = t.pie(data.barbershop.name);
  const html = [
    '<!doctype html><html lang="es-CO"><body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#16211f">',
    '<div style="max-width:480px;margin:0 auto;padding:24px 20px">',
    // The icon of the app (public/icon-192.png) next to the wordmark.
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr>',
    `<td style="padding-right:10px;vertical-align:middle"><img src="${escapeHtml(site)}/icon-192.png" width="40" height="40" alt="${escapeHtml(t.marca)}" style="display:block;border:0;border-radius:10px"></td>`,
    `<td style="vertical-align:middle"><span style="font-size:26px;font-weight:700;color:#16211f">${escapeHtml(t.marcaInicio)}</span><span style="font-size:26px;font-weight:700;color:#1e7f8c">${escapeHtml(t.marcaFin)}</span>`,
    `<span style="font-size:12px;font-weight:700;letter-spacing:2px;color:#1e7f8c;text-transform:uppercase;padding-left:8px">${escapeHtml(t.producto)}</span></td>`,
    "</tr></table>",
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(subject)}</h1>`,
    ...lines.map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${escapeHtml(line)}</p>`,
    ),
    `<p style="margin:22px 0"><a href="${escapeHtml(panel)}" style="display:inline-block;background:#1e7f8c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px">${escapeHtml(t.abrirPanel)}</a></p>`,
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4c5c58">${escapeHtml(footer)}</p>`,
    "</div></body></html>",
  ].join("");
  const text = [...lines, `${t.abrirPanel}: ${panel}`, "", footer].join("\n\n");
  return { subject, html, text };
}

// The email of one queued message, or null when there is no template for its
// type (the appointments' emails arrive with task 5.3).
export function render(type: string, data: EmailData): Email | null {
  const name = data.barbershop.name;
  const expires = longDate(data.subscription.expiresOn);
  const pay = payLine(data);
  const withPay = (paragraphs: string[]) =>
    pay ? [...paragraphs, pay] : paragraphs;
  switch (type) {
    case "subscription_expiring": {
      const trial = data.subscription.status === "trial";
      return frame(
        data,
        trial
          ? t.suscripcion.vence.asuntoPrueba(expires)
          : t.suscripcion.vence.asuntoMes(expires),
        withPay([
          trial
            ? t.suscripcion.vence.cuerpoPrueba(name, expires)
            : t.suscripcion.vence.cuerpoMes(name, expires),
        ]),
      );
    }
    case "subscription_expired":
      return frame(
        data,
        t.suscripcion.vencida.asunto(expires),
        withPay([
          t.suscripcion.vencida.cuerpo(
            name,
            longDate(addDays(data.subscription.expiresOn, GRACE_DAYS)),
          ),
        ]),
      );
    case "subscription_suspended":
      return frame(
        data,
        t.suscripcion.pausada.asunto,
        withPay([t.suscripcion.pausada.cuerpo(name)]),
      );
    case "subscription_payment_registered":
      if (!data.payment) return null;
      return frame(data, t.suscripcion.pago.asunto, [
        t.suscripcion.pago.cuerpo(pesos(data.payment.amountCop), name, expires),
      ]);
    default:
      return null;
  }
}

// The subscription notices that carry, in their payload, the expiry that
// made them due (the contract for task 5.5: payload.expires_on). If the
// barbershop paid in between, the expiry moved and the notice is outdated.
const DATED_NOTICES = new Set([
  "subscription_expiring",
  "subscription_expired",
  "subscription_suspended",
]);

// What to send for one message, or the short code of why it is not sent any
// more: its barbershop is gone, the notice is outdated, the payment was voided
// (or never was), or the type has no template yet.
export function composeEmail(
  type: string,
  payload: Record<string, unknown>,
  data: EmailData | null,
): Email | { cancel: string } {
  if (!data) return { cancel: "no_barbershop" };
  const dueFor = payload.expires_on;
  if (
    DATED_NOTICES.has(type) &&
    typeof dueFor === "string" &&
    dueFor !== data.subscription.expiresOn
  ) {
    return { cancel: "outdated" };
  }
  if (type === "subscription_payment_registered" && !data.payment) {
    return { cancel: "no_payment" };
  }
  return render(type, data) ?? { cancel: "no_template" };
}
