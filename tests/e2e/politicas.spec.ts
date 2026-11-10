import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  createConfirmedOwner,
  policiesSnapshot,
  setPolicies,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.4b: booking and cancellation policies (D-60).
const t = textos.politicas;
const mas = textos.mas;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("politicas");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await page.goto("/ingresar");
  await page.getByLabel(textos.cuentas.ingreso.campos.email).fill(email);
  await page.getByLabel(textos.cuentas.ingreso.campos.password).fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  return slug;
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// The row of D-50, a link named by its content.
const policiesRow = (page: Page) =>
  page.getByRole("link", { name: new RegExp(`^${mas.politicas}`) });

async function openPolicies(page: Page) {
  await page.goto("/panel/mas");
  await expect(
    page.getByRole("heading", { level: 1, name: mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await policiesRow(page).click();
  await expect(page).toHaveURL(/\/panel\/reservas$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

test("an owner changes how close to the time customers book and cancel", async ({
  page,
}) => {
  // The wizard and three screens, each compiled on first use.
  test.setTimeout(180_000);
  const slug = await signInSetUpOwner(page);
  await openPolicies(page);

  // The defaults: 1 hour of notice, 30 days ahead, cancel up to 2 hours before.
  const notice = page.getByRole("combobox", { name: t.anticipacion });
  const cancel = page.getByRole("combobox", { name: t.cancelar });
  await expect(notice).toHaveValue("60");
  await expect(cancel).toHaveValue("2");
  await expect(
    page.getByText(t.ventanaValor(30)).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(t.siempre).filter({ visible: true }),
  ).toBeVisible();
  await checkScreen(page);

  // 3 hours of notice; cancelling up to a day before.
  await notice.selectOption("180");
  await cancel.selectOption("24");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  expect(await policiesSnapshot(slug)).toEqual({
    minBookingNoticeMinutes: 180,
    cancellationNoticeHours: 24,
  });

  // Back on D-60, the saved values.
  await policiesRow(page).click();
  await expect(page).toHaveURL(/\/panel\/reservas$/, FIRST_VISIT);
  await expect(
    page.getByRole("combobox", { name: t.anticipacion }),
  ).toHaveValue("180");
  await expect(page.getByRole("combobox", { name: t.cancelar })).toHaveValue(
    "24",
  );

  // No notice at all, and cancelling up to the time of the appointment.
  await page.getByRole("combobox", { name: t.anticipacion }).selectOption("0");
  await page.getByRole("combobox", { name: t.cancelar }).selectOption("0");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  expect(await policiesSnapshot(slug)).toEqual({
    minBookingNoticeMinutes: 0,
    cancellationNoticeHours: 0,
  });
});

test("a saved value outside the options shows as it is and is kept", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const slug = await signInSetUpOwner(page);
  await setPolicies(slug, {
    minBookingNoticeMinutes: 90,
    cancellationNoticeHours: 5,
  });
  await page.goto("/panel/reservas");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("combobox", { name: t.anticipacion }),
  ).toHaveValue("90");
  await expect(page.getByRole("combobox", { name: t.cancelar })).toHaveValue(
    "5",
  );

  // Saving without touching them keeps them.
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  expect(await policiesSnapshot(slug)).toEqual({
    minBookingNoticeMinutes: 90,
    cancellationNoticeHours: 5,
  });
});
