import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  addReadySedes,
  createConfirmedOwner,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.6: an owner opens a second sede from Más, sets it up, and moves
// between both; each sede sees only its own data. Owners are created already
// confirmed, so no email is sent.
const t = textos.sedes;
const servicios = textos.servicios;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// Más loaded in full each time: a switch reloads the page anyway, and no
// hidden page of the other sede stays mounted.
async function openMore(page: Page) {
  await page.goto("/panel/mas");
  await expect(
    page.getByRole("heading", { level: 1, name: textos.mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  return page.getByRole("region", { name: t.activa });
}

async function switchTo(page: Page, name: string) {
  const card = await openMore(page);
  await card.getByRole("button", { name: t.cambiarEtiqueta }).click();
  const sheet = page.getByRole("dialog", { name: t.hoja.titulo });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: new RegExp(`^${name} `) }).click();
  // A full page load to the agenda: its title, today, means it is the page now.
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
  await expect(
    page
      .getByRole("heading", {
        level: 1,
        name: new RegExp(`^${textos.agenda.hoy("")}`),
      })
      .filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
}

const serviceRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

test("an owner opens a second sede and each sede keeps its own services", async ({
  page,
}) => {
  // Two wizards, a new screen and four full page loads.
  test.setTimeout(240_000);
  const email = uniqueEmail("sedes");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  const second = `Sede Sur ${Date.now().toString(36)}`;

  await page.goto("/ingresar");
  await page.getByLabel(textos.cuentas.ingreso.campos.email).fill(email);
  await page.getByLabel(textos.cuentas.ingreso.campos.password).fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);

  // Más with a single sede: the card shows it and offers a new one.
  let card = await openMore(page);
  await expect(
    card.getByText("Barbería El Parche").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    card.getByText(`yapoin.com/${slug}`).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: t.cambiarEtiqueta }),
  ).toHaveCount(0);
  await checkScreen(page);

  // Nueva sede: the name is required and the trial is shared.
  await card.getByRole("link", { name: t.nueva }).click();
  await expect(page).toHaveURL(/\/panel\/sedes\/nueva$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.nuevaSede.titulo }),
  ).toBeVisible();
  await expect(page.getByText(t.nuevaSede.prueba)).toBeVisible();
  await checkScreen(page);

  const name = page.getByRole("textbox", { name: t.nuevaSede.campos.nombre });
  await page.getByRole("button", { name: t.nuevaSede.crear }).click();
  await expect(
    page.getByText(t.nuevaSede.errores.barbershop_name_required),
  ).toBeVisible(FIRST_VISIT);
  await expect(name).toBeFocused();
  await checkScreen(page);

  // Created, it is the active sede and its own wizard opens, which can
  // send the owner back to the first sede.
  await name.fill(second);
  await page.getByRole("button", { name: t.nuevaSede.crear }).click();
  await expect(page).toHaveURL(/\/panel\/configurar$/, FIRST_VISIT);
  await expect(
    page.getByRole("button", { name: t.cambiarEtiqueta }),
  ).toBeVisible(FIRST_VISIT);
  await finishSetup(page);

  card = await openMore(page);
  await expect(card.getByText(second).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(second).filter({ visible: true })).toHaveCount(2);

  // A service of the second sede only.
  await page.goto("/panel/servicios/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: servicios.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("textbox", { name: servicios.campos.nombre })
    .fill("Tinte");
  await page
    .getByRole("textbox", { name: servicios.campos.precio })
    .fill("45.000");
  await page.getByRole("button", { name: servicios.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/servicios$/, FIRST_VISIT);
  await expect(serviceRow(page, "Tinte")).toBeVisible();

  // Tus sedes lists both, the active one checked.
  card = await openMore(page);
  await card.getByRole("button", { name: t.cambiarEtiqueta }).click();
  const sheet = page.getByRole("dialog", { name: t.hoja.titulo });
  await expect(sheet.getByRole("button")).toHaveCount(3);
  await expect(
    sheet.getByRole("button", { name: new RegExp(`^${second} `) }),
  ).toHaveAttribute("aria-current", "true");
  await checkScreen(page);
  await sheet.getByRole("button", { name: textos.ui.cerrar }).click();

  // The first sede does not see it.
  await switchTo(page, "Barbería El Parche");
  card = await openMore(page);
  await expect(
    card.getByText("Barbería El Parche").filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/panel/servicios");
  await expect(serviceRow(page, "Corte")).toBeVisible(FIRST_VISIT);
  await expect(serviceRow(page, "Tinte")).toHaveCount(0);

  // Back on the second one, it is there.
  await switchTo(page, second);
  await page.goto("/panel/servicios");
  await expect(serviceRow(page, "Tinte")).toBeVisible(FIRST_VISIT);
});

async function signInReady(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel(textos.cuentas.ingreso.campos.email).fill(email);
  await page.getByLabel(textos.cuentas.ingreso.campos.password).fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
}

// Task 2.6b: the owner deletes a sede from Datos y fotos, and is left on the
// other one; the deleted sede's link no longer leads anywhere.
test("an owner deletes a second sede and goes back to the first one", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email = uniqueEmail("sedes-eliminar");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  const second = `Sede Norte ${Date.now().toString(36)}`;
  await signInReady(page, email);
  const [sede] = await addReadySedes(slug, [second]);
  if (!sede) throw new Error("No second sede");

  await switchTo(page, second);
  await page.goto("/panel/datos");
  await expect(
    page.getByRole("heading", { level: 1, name: textos.datos.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("button", { name: t.eliminar.boton })
    .filter({ visible: true })
    .click();
  const sheet = page.getByRole("dialog", { name: t.eliminar.titulo });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(t.eliminar.bajada(second))).toBeVisible();
  const confirm = sheet.getByRole("button", { name: t.eliminar.confirmar });
  await expect(confirm).toBeDisabled();
  await checkScreen(page);

  await sheet.getByRole("textbox", { name: t.eliminar.campo }).fill(second);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  // A full page load to the agenda of the first sede, which says so.
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
  await expect(
    page.getByText(t.eliminada(second)).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);

  // A single sede again: no switch, and nothing to delete.
  const card = await openMore(page);
  await expect(
    card.getByText("Barbería El Parche").filter({ visible: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: t.cambiarEtiqueta }),
  ).toHaveCount(0);
  await expect(card.getByRole("link", { name: t.nueva })).toBeVisible();
  await page.goto("/panel/datos");
  await expect(
    page.getByRole("heading", { level: 1, name: textos.datos.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("button", { name: t.eliminar.boton }),
  ).toHaveCount(0);

  // Its link leads nowhere, and the first one still works.
  await page.goto(`/${sede.slug}`);
  await expect(
    page.getByRole("heading", { name: textos.reservas.noExiste.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page.goto(`/${slug}`);
  await expect(
    page.getByRole("heading", {
      name: "Barbería El Parche",
    }),
  ).toBeVisible(FIRST_VISIT);
});

// Task 2.6b: with 4 sedes, "Nueva sede" is off and its screen says why.
test("an owner with 4 sedes cannot open a fifth one", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("sedes-tope");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await signInReady(page, email);
  await addReadySedes(slug, ["Sede Dos", "Sede Tres", "Sede Cuatro"]);

  const card = await openMore(page);
  await card.getByRole("button", { name: t.cambiarEtiqueta }).click();
  const sheet = page.getByRole("dialog", { name: t.hoja.titulo });
  await expect(
    sheet.getByRole("button", { name: /yapoin\.com\// }),
  ).toHaveCount(4);
  await expect(sheet.getByRole("link", { name: t.nueva })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: t.nueva })).toBeDisabled();
  await expect(sheet.getByText(t.limite)).toBeVisible();
  await checkScreen(page);

  await page.goto("/panel/sedes/nueva");
  await expect(page.getByText(t.nuevaSede.limiteTitulo)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("button", { name: t.nuevaSede.crear }),
  ).toHaveCount(0);
  await checkScreen(page);
});
