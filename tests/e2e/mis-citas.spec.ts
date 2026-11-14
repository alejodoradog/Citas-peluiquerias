import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  chooseServicesAndBarber,
  chooseTomorrowAt,
  fillAndConfirm,
  FIRST_VISIT,
} from "./helpers/reserva";
import {
  createBookableShop,
  issueMyAppointmentsLink,
  myAppointmentsEmails,
} from "./helpers/supabase";

// "Mis citas" (C-19 to C-21): the customer asks for the link with their
// email, always gets the same answer, and the link of the email lists their
// upcoming appointments, each with its own link to manage it.
const t = textos.reservas;
const m = t.misCitas;

test("a customer gets the link to their appointments and opens one", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("mis-citas");
  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Ana");
  await chooseTomorrowAt(page, "11:00");
  await fillAndConfirm(page, "Camila Rojas", "camila@correo.com");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t.confirmada.titulo("Camila"),
    }),
  ).toBeVisible(FIRST_VISIT);

  // C-19, from the barbershop's page.
  await page.goto(`/${shop.slug}`);
  await page.getByRole("link", { name: m.entrada }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: m.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // An unknown email gets the same answer, and nothing is sent.
  await page.getByRole("textbox", { name: m.correo }).fill("nadie@correo.com");
  await page.getByRole("button", { name: m.enviar }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: m.enviado.titulo }),
  ).toBeVisible();
  expect(await myAppointmentsEmails(shop.id)).toHaveLength(0);

  // The customer's email: the same answer, and the email is queued.
  await page.getByRole("button", { name: m.enviado.otro }).click();
  await page.getByRole("textbox", { name: m.correo }).fill("Camila@Correo.com");
  await page.getByRole("button", { name: m.enviar }).click();
  await expect(
    page.getByText(m.enviado.detalle("Camila@Correo.com")),
  ).toBeVisible();
  expect(await myAppointmentsEmails(shop.id)).toHaveLength(1);

  // C-21, from a link like the email's.
  const token = await issueMyAppointmentsLink(shop.id, "camila@correo.com");
  await page.goto(`/${shop.slug}/mis-citas/${token}`);
  await expect(
    page.getByRole("heading", { level: 1, name: m.lista.titulo("Camila") }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await page.getByRole("button", { name: m.lista.ver }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.gestionar.titulo("Camila") }),
  ).toBeVisible(FIRST_VISIT);
});

test("a link of Mis citas that does not work asks for a new one", async ({
  page,
}) => {
  const shop = await createBookableShop("mis-citas-vencido");
  await page.goto(`/${shop.slug}/mis-citas/${"x".repeat(43)}`);
  await expect(
    page.getByRole("heading", { level: 1, name: m.vencido.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("link", { name: m.vencido.pedir }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: m.titulo }),
  ).toBeVisible(FIRST_VISIT);
});
