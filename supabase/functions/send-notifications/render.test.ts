import { describe, expect, it } from "vitest";
import { addDays, longDate, pesos, render, type EmailData } from "./render";

function data(extra: Partial<EmailData> = {}): EmailData {
  return {
    barbershop: { name: "Barbería La Esquina", slug: "la-esquina" },
    ownerName: "Mario",
    subscription: {
      status: "trial",
      expiresOn: "2026-11-24",
      planPriceCop: 25000,
    },
    payment: null,
    payInfo: { breB: null, nequi: null, email: null },
    siteUrl: "https://www.yapoin.com/",
    ...extra,
  };
}

describe("helpers", () => {
  it("writes dates and pesos as the app does", () => {
    expect(longDate("2026-11-24")).toBe("24 de noviembre de 2026");
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
    expect(pesos(25000)).toBe("$25.000");
  });
});

describe("render", () => {
  it("warns that the trial is about to end, with how to pay", () => {
    const email = render(
      "subscription_expiring",
      data({
        payInfo: {
          breB: "@yapoin",
          nequi: "3001234567",
          email: "pagos@yapoin.com",
        },
      }),
    )!;
    expect(email.subject).toBe(
      "Tu prueba gratis vence el 24 de noviembre de 2026",
    );
    expect(email.text).toContain("Hola, Mario.");
    expect(email.text).toContain(
      "Paga $25.000 por llave Bre-B @yapoin o Nequi 3001234567 y envía el comprobante a pagos@yapoin.com.",
    );
    expect(email.text).toContain(
      "Abrir mi panel: https://www.yapoin.com/panel",
    );
    expect(email.html).toContain('href="https://www.yapoin.com/panel"');
  });

  it("promises the payment data while they are not set (decision E5)", () => {
    const email = render(
      "subscription_expiring",
      data({
        subscription: {
          status: "active",
          expiresOn: "2026-11-24",
          planPriceCop: 25000,
        },
      }),
    )!;
    expect(email.subject).toBe(
      "Tu mes en Yapoin vence el 24 de noviembre de 2026",
    );
    expect(email.text).toContain(
      "El valor es $25.000 al mes. Te enviaremos los datos de pago por correo.",
    );
  });

  it("says until when an expired barbershop keeps its bookings", () => {
    const email = render("subscription_expired", data())!;
    expect(email.subject).toBe("Tu barbería venció el 24 de noviembre de 2026");
    expect(email.text).toContain("hasta el 29 de noviembre de 2026");
  });

  it("says the barbershop is paused", () => {
    expect(render("subscription_suspended", data())!.subject).toBe(
      "Tu barbería está pausada",
    );
  });

  it("confirms a payment, without asking for another", () => {
    const email = render(
      "subscription_payment_registered",
      data({
        subscription: {
          status: "active",
          expiresOn: "2026-12-24",
          planPriceCop: 25000,
        },
        payment: { amountCop: 25000 },
      }),
    )!;
    expect(email.text).toContain(
      "Registramos tu pago de $25.000. Barbería La Esquina queda activa hasta el 24 de diciembre de 2026.",
    );
    expect(email.text).not.toContain("Paga");
    expect(render("subscription_payment_registered", data())).toBeNull();
  });

  it("escapes every value in the HTML", () => {
    const email = render(
      "subscription_suspended",
      data({
        barbershop: { name: '<script>alert("x")</script>', slug: "x" },
        ownerName: "A & B",
      }),
    )!;
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A &amp; B");
  });

  it("has no template for the appointments' emails yet (task 5.3)", () => {
    expect(render("appointment_confirmed", data())).toBeNull();
  });
});
