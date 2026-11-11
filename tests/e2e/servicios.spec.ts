import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// Task 2.2a: the owner manages services from Más (D-50 to D-52). Owners are
// created already confirmed, so no email is sent.
const t = textos.servicios;
const mas = textos.mas;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("servicios");
  await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await page.goto("/ingresar");
  await page.getByLabel(textos.cuentas.ingreso.campos.email).fill(email);
  await page.getByLabel(textos.cuentas.ingreso.campos.password).fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  // Corte, Barba and Cejas, done by the owner ("Yo también corto").
  await finishSetup(page);
  return { email };
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// A service row is one link named by its content ("Tinte 60 min $45.000").
const serviceRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

test("an owner adds, edits and deactivates a service", async ({ page }) => {
  // A long flow through the wizard and three new screens; the dev server
  // compiles each page on first use.
  test.setTimeout(180_000);
  const { email } = await signInSetUpOwner(page);

  // D-50: Más, with the counts and the account.
  await page
    .getByRole("navigation", { name: textos.ui.navegacion.etiqueta })
    .getByRole("link", { name: textos.ui.navegacion.mas })
    .click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: mas.titulo }),
  ).toBeVisible();
  // Next.js keeps the previous page mounted and hidden: only visible text.
  await expect(
    page.getByText("Barbería El Parche").filter({ visible: true }).first(),
  ).toBeVisible();
  const servicesRow = page.getByRole("link", {
    name: new RegExp(`^${mas.servicios}`),
  });
  await expect(servicesRow).toContainText(mas.conteoServicios(3));
  await expect(
    page.getByRole("link", { name: new RegExp(`^${mas.barberos}`) }),
  ).toContainText(mas.conteoBarberos(1));
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(mas.pronto).first()).toBeVisible();
  await checkScreen(page);

  // D-51: the services of the wizard.
  await servicesRow.click();
  await expect(page).toHaveURL(/\/panel\/servicios$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible();
  await expect(serviceRow(page, "Corte")).toContainText("$25.000");
  await checkScreen(page);

  // D-52: a new service, done by the owner by default.
  await page.getByRole("link", { name: t.agregar }).first().click();
  await expect(page).toHaveURL(/\/panel\/servicios\/nuevo$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.nuevo }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Carlos Pérez" }),
  ).toBeChecked();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await checkScreen(page);

  const name = page.getByRole("textbox", { name: t.campos.nombre });
  const price = page.getByRole("textbox", { name: t.campos.precio });
  const save = page.getByRole("button", { name: t.guardar });

  // Errors are explained and focused: no name, a price with decimals, and a
  // name the barbershop already has (whatever its case).
  await price.fill("45.000");
  await save.click();
  await expect(page.getByText(t.errores.service_name_required)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(name).toBeFocused();
  await checkScreen(page);

  await name.fill("Tinte");
  await price.fill("25,5");
  await save.click();
  await expect(page.getByText(t.errores.service_price_invalid)).toBeVisible();
  await expect(price).toBeFocused();
  await expect(name).toHaveValue("Tinte");

  await name.fill("corte");
  await price.fill("45.000");
  await save.click();
  await expect(page.getByText(t.errores.service_name_taken)).toBeVisible();
  await expect(name).toBeFocused();

  await name.fill("Tinte");
  await page
    .getByRole("combobox", { name: t.campos.duracion })
    .selectOption("60");
  await save.click();
  await expect(page).toHaveURL(/\/panel\/servicios$/, FIRST_VISIT);
  const tinte = serviceRow(page, "Tinte");
  await expect(tinte).toContainText("60 min");
  await expect(tinte).toContainText("$45.000");

  // Edit its price.
  await tinte.click();
  await expect(page).toHaveURL(
    /\/panel\/servicios\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: t.editar }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: t.campos.precio }),
  ).toHaveValue("45.000");
  await expect(page.getByRole("switch", { name: t.activo })).toBeChecked();
  await checkScreen(page);
  await page.getByRole("textbox", { name: t.campos.precio }).fill("50.000");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/servicios$/, FIRST_VISIT);
  await expect(serviceRow(page, "Tinte")).toContainText("$50.000");

  // Deactivate it: it moves to "Inactivos".
  await serviceRow(page, "Tinte").click();
  await expect(page).toHaveURL(/\/panel\/servicios\/[0-9a-f-]{36}$/);
  await page
    .getByRole("switch", { name: t.activo })
    // Visually hidden native input: its drawn switch takes the tap.
    .uncheck({ force: true });
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/servicios$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 2, name: t.inactivos }),
  ).toBeVisible();
  await expect(serviceRow(page, "Tinte")).toContainText(t.inactivo);
  await checkScreen(page);

  // Más counts active services only.
  await page.getByRole("link", { name: textos.ui.volver }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${mas.servicios}`) }),
  ).toContainText(mas.conteoServicios(3));
});

test("a service link that leads nowhere is not found", async ({ page }) => {
  test.setTimeout(90_000);
  await signInSetUpOwner(page);
  for (const id of ["no-existe", "00000000-0000-0000-0000-000000000000"]) {
    await page.goto(`/panel/servicios/${id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
    ).toBeVisible(FIRST_VISIT);
  }
});
