import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { signInProfessional } from "./helpers/clientes";
import {
  chooseTomorrowAt,
  fillAndConfirm,
  FIRST_VISIT,
} from "./helpers/reserva";
import {
  createBookableShop,
  createProfessionalAccount,
  uniqueEmail,
  webAppointments,
} from "./helpers/supabase";

// Task 8.13: a professional shares their own booking link from "Mi agenda",
// and a customer who opens it books with them, in the establishment where
// they work, without choosing a professional. The button is of task 7.6b;
// this is the whole way, from the tap to the appointment.
const m = textos.miAgenda;
const t = textos.reservas;

test("the link a professional shares books with them, without asking who", async ({
  page,
  context,
  browser,
}) => {
  // The clipboard is only readable in Chromium.
  test.skip(test.info().project.name !== "android", "reads the clipboard");
  test.setTimeout(240_000);

  // Beto is the second professional: "the first one free" would be Ana, so
  // an appointment with Beto can only come from the link.
  const shop = await createBookableShop("link-profesional");
  const beto = {
    email: uniqueEmail("beto-link"),
    password: "clave-de-beto-1",
  };
  await createProfessionalAccount(shop.barbers.beto, { ...beto, name: "Beto" });

  // Where there is no share sheet the button copies the link, and says so.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });
  await signInProfessional(page, beto);
  await page
    .getByRole("button", { name: m.compartir.boton })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText(textos.ui.compartir.copiado).filter({ visible: true }),
  ).toBeVisible();
  const shared = new URL(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  expect(shared.pathname).toBe(`/${shop.slug}/reservar`);
  expect(shared.searchParams.get("profesional")).toBe(shop.barbers.beto);
  // Nothing else travels in it: no session, no email, no name.
  expect([...shared.searchParams.keys()]).toEqual(["profesional"]);

  // A customer, with no session, opens it.
  const phone = await browser.newContext({ ...test.info().project.use });
  const customer = await phone.newPage();
  await customer.goto(`${shared.pathname}${shared.search}`);
  await expect(
    customer.getByRole("heading", { level: 1, name: t.servicios.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await customer
    .getByRole("checkbox", { name: /Corte/ })
    .filter({ visible: true })
    .check({ force: true });
  await customer
    .getByRole("button", { name: t.continuar })
    .filter({ visible: true })
    .click();
  // Straight to the time: the step that asks who is skipped.
  await expect(
    customer.getByRole("heading", { level: 1, name: t.hora.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(customer).toHaveURL(
    new RegExp(`profesional=${shop.barbers.beto}`),
  );
  await expect(
    customer.getByRole("heading", { level: 1, name: t.barbero.titulo }),
  ).toHaveCount(0);

  await chooseTomorrowAt(customer, "10:00");
  await fillAndConfirm(customer, "Camila Rojas", uniqueEmail("camila-link"));
  await expect(
    customer.getByRole("heading", {
      level: 1,
      name: t.confirmada.titulo("Camila"),
    }),
  ).toBeVisible(FIRST_VISIT);

  // The appointment is Beto's, in his establishment.
  const appointments = await webAppointments(shop.id);
  expect(appointments).toHaveLength(1);
  expect(appointments[0]?.barber_id).toBe(shop.barbers.beto);
  await phone.close();
});

test("a shared link of a professional who no longer attends asks to choose again", async ({
  page,
}) => {
  const shop = await createBookableShop("link-inactivo");
  // Not an id of this establishment: as a professional who left.
  const gone = "00000000-0000-4000-8000-000000000813";
  await page.goto(`/${shop.slug}/reservar?profesional=${gone}`);
  await expect(
    page.getByRole("heading", { level: 1, name: t.servicios.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("checkbox", { name: /Corte/ })
    .filter({ visible: true })
    .check({ force: true });
  await page
    .getByRole("button", { name: t.continuar })
    .filter({ visible: true })
    .click();
  // The customer is not left at a dead end: they choose who.
  await expect(
    page.getByRole("heading", { level: 1, name: t.barbero.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: /^Ana/ }).filter({ visible: true }),
  ).toBeVisible();
});
