import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  formatBogotaDayMonth,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { LEGAL_VERSION } from "../../src/lib/legal/version";
import { slugFromName } from "../../src/modulos/barberias/dominio/slug";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import { signInOwner } from "./helpers/clientes";
import {
  chooseServicesAndBarber,
  chooseTomorrowAt,
  fillAndConfirm,
  FIRST_VISIT,
} from "./helpers/reserva";
import {
  acceptedTermsOf,
  appointmentEmails,
  createBookableShop,
  createSuperAdmin,
  customerConfirmations,
  latestEmailLink,
  queuedEmails,
  setExpiresOn,
  uniqueEmail,
  webAppointments,
} from "./helpers/supabase";

// Task 6.1: the three flows of the spec ("Flujos principales"), each from end
// to end, as a person goes through them on a phone. The screens of each step
// have their own tests; these check that the steps join up.
const r = textos.reservas;
const c = textos.cuentas;
const p = textos.plataforma;
const PASSWORD = "clave-segura-1";

test.describe.configure({ mode: "serial" });

// Flow 1, "Reserva del cliente": the barbershop's link, services, barber,
// day and time, details, and the reminder that is the customer's only email;
// from its link, "Confirmo" with one tap.
test("flow 1: a customer books, gets the reminder queued and confirms", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("flujo-reserva");

  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Ana");
  await chooseTomorrowAt(page, "11:30");
  await fillAndConfirm(page, "Valentina Ortiz", "valentina@correo.com");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: r.confirmada.titulo("Valentina"),
    }),
  ).toBeVisible(FIRST_VISIT);

  const [appointment] = await webAppointments(shop.id);
  expect(appointment).toMatchObject({ status: "confirmed", source: "web" });
  const emails = await appointmentEmails(shop.id);
  expect(emails.map((email) => email.type)).toContain("appointment_reminder");
  expect(emails.map((email) => email.type)).not.toContain(
    "appointment_confirmed",
  );

  const href = await page
    .getByRole("link", { name: r.confirmada.gestionar })
    .getAttribute("href");
  await page.goto(`${href}?confirmo=1`);
  await page.getByRole("button", { name: r.gestionar.confirmar.si }).click();
  await expect(
    page
      .getByText(r.gestionar.confirmar.yaConfirmaste, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  expect(
    (await customerConfirmations(shop.id))[0]!.customer_confirmed_at,
  ).not.toBeNull();
});

// Flow 2, "Registro de la barbería": sign up with the box of the terms,
// confirm the email, set it up with the wizard and share a link that takes
// bookings. The spec's goal is under 10 minutes for a person; here it runs
// in well under that.
test("flow 2: a barbershop signs up, confirms, sets up and takes bookings", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const started = Date.now();
  const email = uniqueEmail("flujo-registro");
  const barbershop = `Barbería Flujo ${Date.now().toString(36)}`;

  await page.goto("/registro");
  await page.getByLabel(c.registro.campos.ownerName).fill("Daniela Ríos");
  await page.getByLabel(c.registro.campos.barbershopName).fill(barbershop);
  await page
    .getByRole("combobox", { name: c.registro.campos.businessType })
    .selectOption("barbershop");
  await page.getByLabel(c.registro.campos.phone).fill("300 765 4321");
  await page.getByLabel(c.registro.campos.email).fill(email);
  await page.getByLabel(c.registro.campos.password).fill(PASSWORD);
  await page
    .getByRole("checkbox", { name: textos.legal.casilla.registro })
    .check({ force: true });
  await page.getByRole("button", { name: c.registro.enviar }).click();
  await expect(
    page.getByRole("heading", { name: c.registro.revisaCorreo.titulo }),
  ).toBeVisible(FIRST_VISIT);
  // The proof of the authorization (task 6.5).
  expect(await acceptedTermsOf(email)).toMatchObject({
    terms_version: LEGAL_VERSION,
  });

  await page.goto(await latestEmailLink(email, "signup"));
  await page.getByRole("button", { name: c.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/ingresar\?confirmado=1$/, FIRST_VISIT);
  await page.getByLabel(c.ingreso.campos.email).fill(email);
  await page.getByLabel(c.ingreso.campos.password).fill(PASSWORD);
  await page.getByRole("button", { name: c.ingreso.enviar }).click();
  await finishSetup(page);

  // Its link is live: the page offers to book.
  await page.goto(`/${slugFromName(barbershop)}`);
  await expect(
    page.getByRole("heading", { level: 1, name: barbershop }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: r.perfil.reservar }),
  ).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10 * 60_000);
});

// Flow 3, "Cobro y activación": the owner is warned before the end, with the
// price of their tier and how to pay (task 5.6); the super admin registers
// the payment, the barbershop is active again, and the email "Recibimos tu
// pago" is queued for the owner.
test("flow 3: the owner is warned, the super admin registers the payment and it is active", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const name = `Barbería Cobro ${Date.now().toString(36)}`;
  const shop = await createBookableShop("flujo-cobro", name);
  const today = toBogotaDate(new Date());
  const soon = addDays(today, 2);
  await setExpiresOn(shop.id, soon);

  // The owner's agenda warns two days before (D-70), with the price.
  await signInOwner(page, shop.owner);
  const warning = page
    .getByRole("status")
    .or(page.getByRole("alert"))
    .filter({
      hasText: textos.suscripcion.vencePrueba(
        formatBogotaDayMonth(startOfBogotaDay(soon)),
      ),
      visible: true,
    });
  await expect(warning).toBeVisible(FIRST_VISIT);
  await expect(warning).toContainText("$25.000");

  // The super admin, on another phone.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const adminEmail = uniqueEmail("flujo-cobro-admin");
  await createSuperAdmin(adminEmail, PASSWORD);
  await signIn(admin, adminEmail);
  await expect(admin).toHaveURL(/\/admin$/, FIRST_VISIT);
  await admin.goto(`/admin/barberias/${shop.id}`);
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible(
    FIRST_VISIT,
  );
  await admin.getByRole("link", { name: p.ficha.registrarPago }).click();
  await expect(
    admin.getByRole("heading", { level: 1, name: p.pago.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    admin.getByText(/Hasta 4 profesionales/).filter({ visible: true }),
  ).toBeVisible();
  await admin
    .getByRole("combobox", { name: p.pago.medio })
    .selectOption("nequi");
  await admin
    .getByRole("textbox", { name: p.pago.referencia })
    .fill("NEQ-FLUJO-3");
  await admin.getByRole("button", { name: p.pago.enviar }).click();
  await expect(
    admin.getByText(p.ficha.hecho.pago).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    admin.getByText(p.estados.active).filter({ visible: true }).first(),
  ).toBeVisible();
  await adminContext.close();

  // "Recibimos tu pago" waits in the queue for the owner (task 5.5).
  expect(
    (await queuedEmails(shop.id, "subscription_payment_registered")).length,
  ).toBe(1);

  // The owner's agenda no longer warns: a month was added.
  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(`^${textos.agenda.hoy("")}`),
    }),
  ).toBeVisible(FIRST_VISIT);
  await expect(warning).toHaveCount(0);
});

async function signIn(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByRole("textbox", { name: c.ingreso.campos.email }).fill(email);
  await page
    .getByRole("textbox", { name: c.ingreso.campos.password })
    .fill(PASSWORD);
  await page.getByRole("button", { name: c.ingreso.enviar }).click();
}
