import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  createConfirmedOwner,
  setupSnapshot,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.1: the setup wizard (D-10 to D-14), from the first sign-in to the
// agenda. Owners are created already confirmed, so no email is sent.
const t = textos.asistente;
const PASSWORD = "clave-segura-1";
// The row button is named "Editar Corte 40 min $25.000"; tests find it by
// its start, so a price change does not change how it is found.
const editar = (nombre: string) => `${t.servicios.editar} ${nombre}`;

async function signInNewOwner(page: Page, tag: string) {
  const email = uniqueEmail(tag);
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
  // The dev server compiles each page the first time it is opened.
  await expect(page).toHaveURL(/\/panel\/configurar$/, { timeout: 20_000 });
  return { slug };
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

test("an owner sets up services and team, and gets the link to share", async ({
  page,
  context,
}) => {
  // A long flow, and the dev server compiles each page on first use.
  test.setTimeout(180_000);
  const { slug } = await signInNewOwner(page, "asistente");

  // D-10: the suggested services, Niños unchecked.
  await expect(
    page.getByRole("heading", { level: 1, name: t.servicios.titulo }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: t.servicios.ofrecer("Niños") }),
  ).not.toBeChecked();
  await checkScreen(page);

  // D-11: edit Corte.
  await page.getByRole("button", { name: editar("Corte") }).click();
  const sheet = page.getByRole("dialog", { name: t.servicio.editar });
  await expect(sheet).toBeVisible();
  await checkScreen(page);
  await sheet.getByLabel(t.servicio.campos.precio).fill("28.000");
  await sheet.getByLabel(t.servicio.campos.duracion).selectOption("45");
  await sheet.getByRole("button", { name: t.servicio.guardar }).click();
  await expect(sheet).not.toBeVisible();
  const corte = page.getByRole("button", { name: editar("Corte") });
  await expect(corte).toContainText("$28.000");
  await expect(corte).toContainText("45 min");

  // A price with decimals is explained and focused.
  await page.getByRole("button", { name: editar("Barba") }).click();
  await sheet.getByLabel(t.servicio.campos.precio).fill("25,5");
  await sheet.getByRole("button", { name: t.servicio.guardar }).click();
  await expect(sheet.getByText(t.errores.service_price_invalid)).toBeVisible();
  await expect(sheet.getByLabel(t.servicio.campos.precio)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();

  // A new service, and Cejas left out.
  await page.getByRole("button", { name: t.servicios.agregar }).click();
  const nuevo = page.getByRole("dialog", { name: t.servicio.nuevo });
  await nuevo.getByLabel(t.servicio.campos.nombre).fill("Diseño");
  await nuevo.getByLabel(t.servicio.campos.precio).fill("10000");
  await nuevo.getByLabel(t.servicio.campos.duracion).selectOption("15");
  await nuevo.getByRole("button", { name: t.servicio.guardar }).click();
  await expect(
    page.getByRole("button", { name: editar("Diseño") }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: t.servicios.ofrecer("Cejas") })
    // Visually hidden native input: its drawn box takes the tap.
    .uncheck({ force: true });

  // D-12: the owner cuts by default.
  await page.getByRole("link", { name: t.servicios.continuar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("checkbox", { name: new RegExp(t.equipo.yoCorto) }),
  ).toBeChecked();
  await expect(page.getByText(t.equipo.tu, { exact: true })).toBeVisible();
  await checkScreen(page);

  // D-13: add a barber; a bad email is explained.
  await page.getByRole("link", { name: t.equipo.agregar }).click();
  await expect(page).toHaveURL(/\/equipo\/barbero$/, { timeout: 20_000 });
  await page.getByLabel(t.barbero.campos.nombre).fill("Kevin");
  await page.getByLabel(new RegExp(t.barbero.campos.correo)).fill("kevin@");
  await page.getByRole("button", { name: t.barbero.guardar }).click();
  await expect(page.getByText(t.errores.email_invalid)).toBeVisible();
  await checkScreen(page);
  await page
    .getByLabel(new RegExp(t.barbero.campos.correo))
    .fill("Kevin@Correo.com");
  await page.getByRole("checkbox", { name: "Barba" }).uncheck({ force: true });
  await page.getByRole("button", { name: t.barbero.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/);
  await expect(page.getByRole("link", { name: /Kevin/ })).toContainText(
    t.equipo.resumen(2),
  );

  // The draft survives a reload.
  await page.reload();
  await expect(page.getByRole("link", { name: /Kevin/ })).toBeVisible();

  // D-14: the setup is saved and the link is ready.
  await page.getByRole("button", { name: t.equipo.terminar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: t.listo.titulo }),
  ).toBeVisible();
  await expect(page.getByText(`yapoin.com/${slug}`)).toBeVisible();
  await expect(page.getByRole("img", { name: t.listo.qr })).toBeVisible();
  await checkScreen(page);

  if (test.info().project.name === "android") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: t.listo.copiar }).click();
    await expect(page.getByText(t.listo.copiado)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `https://yapoin.com/${slug}`,
    );
  }

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: t.listo.descargarQr }).click();
  expect((await download).suggestedFilename()).toBe(`qr-yapoin-${slug}.png`);

  expect(await setupSnapshot(slug)).toEqual({
    services: [
      { name: "Barba", price_cop: 15000, duration_minutes: 20 },
      { name: "Corte", price_cop: 28000, duration_minutes: 45 },
      { name: "Diseño", price_cop: 10000, duration_minutes: 15 },
    ],
    barbers: [
      { name: "Carlos Pérez", email: null, isOwner: true, services: 3 },
      { name: "Kevin", email: "kevin@correo.com", isOwner: false, services: 2 },
    ],
    hourRows: 6,
  });

  // The agenda, and no way back into the wizard.
  await page.getByRole("link", { name: t.listo.agenda }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
  await page.goto("/panel/configurar");
  await expect(page).toHaveURL(/\/panel$/);
});

test("an owner can finish later without barbers", async ({ page }) => {
  test.setTimeout(90_000);
  const { slug } = await signInNewOwner(page, "asistente-despues");

  await page.getByRole("link", { name: t.servicios.continuar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, {
    timeout: 20_000,
  });
  await page
    .getByRole("checkbox", { name: new RegExp(t.equipo.yoCorto) })
    // Visually hidden native input: its drawn box takes the tap.
    .uncheck({ force: true });
  await page.getByRole("button", { name: t.equipo.despues }).click();

  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: t.listo.tituloSinBarberos }),
  ).toBeVisible();
  await expect(page.getByText(t.listo.sinBarberos)).toBeVisible();
  const snapshot = await setupSnapshot(slug);
  expect(snapshot.services.map((s) => s.name)).toEqual([
    "Barba",
    "Cejas",
    "Corte",
  ]);
  expect(snapshot.barbers).toEqual([]);
});
