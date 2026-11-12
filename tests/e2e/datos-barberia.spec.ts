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
  shopProfileSnapshot,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.4d: the barbershop's data and photos (D-57).
const t = textos.datos;
const mas = textos.mas;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

// Two tiny PNGs, made here so the test needs no files. The browser shrinks
// them and uploads WebP.
const RED_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);
const GREY_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const png = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "image/png",
  buffer,
});

const storageImage = (kind: "logo" | "cover") =>
  new RegExp(
    `/storage/v1/object/public/images/[0-9a-f-]{36}/${kind}/[0-9a-f-]{36}\\.(webp|jpg)$`,
  );

// Cali, where Yapoin starts.
const CALI = { latitude: 3.451647, longitude: -76.532013 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("datos");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
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
const dataRow = (page: Page) =>
  page.getByRole("link", { name: new RegExp(`^${mas.datos}`) });

async function openData(page: Page) {
  await page.goto("/panel/mas");
  await expect(
    page.getByRole("heading", { level: 1, name: mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await dataRow(page).click();
  await expect(page).toHaveURL(/\/panel\/datos$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

async function save(page: Page) {
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
}

const field = (page: Page, name: string) => page.getByRole("textbox", { name });

test("an owner changes the data, the logo, the cover and the location", async ({
  page,
  context,
}) => {
  // The wizard and three screens, each compiled on first use, and four uploads.
  test.setTimeout(240_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(CALI);
  const slug = await signInSetUpOwner(page);
  await openData(page);

  // What the sign-up left: the name and the owner's mobile as the WhatsApp.
  await expect(field(page, t.campos.nombre)).toHaveValue("Barbería El Parche");
  await expect(field(page, t.campos.whatsapp)).toHaveValue("300 123 4567");
  await expect(field(page, t.campos.direccion)).toHaveValue("");
  await expect(
    page.getByRole("img", { name: t.logo.sinLogo }).filter({ visible: true }),
  ).toHaveText("EP");
  await checkScreen(page);

  await field(page, t.campos.nombre).fill("Barbería El Parche Norte");
  await field(page, t.campos.direccion).fill("Calle 5 # 38-25");
  await field(page, t.campos.barrio).fill("San Fernando, Cali");
  await field(page, t.campos.whatsapp).fill("310 555 1234");
  await page
    .getByLabel(t.logo.agregar)
    .filter({ visible: true })
    .setInputFiles(png("logo.png", RED_PIXEL));
  await expect(page.getByText(t.logo.lista)).toBeVisible(FIRST_VISIT);
  await page
    .getByLabel(t.portada.agregar)
    .filter({ visible: true })
    .setInputFiles(png("portada.png", RED_PIXEL));
  await expect(page.getByText(t.portada.lista)).toBeVisible(FIRST_VISIT);
  // Playwright drops its simulated position when an iframe of another site
  // goes away, as Turnstile's does after signing in (task 3.5); a real phone
  // has no simulation to lose. It is set again right before it is asked.
  await context.setGeolocation(CALI);
  await page.getByRole("button", { name: t.ubicacion.usar }).click();
  await expect(
    page.getByText(t.ubicacion.marcada).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: t.ubicacion.verNuevaPestana }),
  ).toHaveAttribute("href", /query=3\.451647%2C-76\.532013$/);
  await save(page);

  // Más names the barbershop by its new name, in its top bar and in the card
  // of the active sede (task 2.6); the link stays (D-61, 2.4e).
  await expect(
    page.getByText("Barbería El Parche Norte").filter({ visible: true }),
  ).toHaveCount(2);
  const first = await shopProfileSnapshot(slug);
  expect(first).toMatchObject({
    name: "Barbería El Parche Norte",
    address: "Calle 5 # 38-25",
    locality: "San Fernando, Cali",
    whatsappPhone: "+573105551234",
    latitude: CALI.latitude,
    longitude: CALI.longitude,
  });
  expect(first.logoObjects).toEqual([first.logoPath]);
  expect(first.coverObjects).toEqual([first.coverPath]);

  // Back on D-57: what was saved, and both images from Storage.
  await dataRow(page).click();
  await expect(page).toHaveURL(/\/panel\/datos$/, FIRST_VISIT);
  await expect(field(page, t.campos.barrio)).toHaveValue("San Fernando, Cali");
  await expect(field(page, t.campos.whatsapp)).toHaveValue("310 555 1234");
  await expect(
    page.getByRole("img", { name: t.logo.actual }).filter({ visible: true }),
  ).toHaveAttribute("src", storageImage("logo"));
  await expect(
    page.getByText(t.ubicacion.guardada).filter({ visible: true }),
  ).toBeVisible();
  await checkScreen(page);

  // Replacing both leaves one file per kind: the old ones are deleted.
  await page
    .getByLabel(t.logo.cambiar)
    .filter({ visible: true })
    .setInputFiles(png("logo-2.png", GREY_PIXEL));
  await expect(page.getByText(t.logo.lista)).toBeVisible(FIRST_VISIT);
  await page
    .getByLabel(t.portada.cambiar)
    .filter({ visible: true })
    .setInputFiles(png("portada-2.png", GREY_PIXEL));
  await expect(page.getByText(t.portada.lista)).toBeVisible(FIRST_VISIT);
  await save(page);
  const second = await shopProfileSnapshot(slug);
  expect(second.logoPath).not.toBeNull();
  expect(second.logoPath).not.toBe(first.logoPath);
  expect(second.coverPath).not.toBe(first.coverPath);
  expect(second.logoObjects).toEqual([second.logoPath]);
  expect(second.coverObjects).toEqual([second.coverPath]);

  // "Quitar logo" and "Quitar portada" delete at once: no file left.
  await dataRow(page).click();
  await expect(page).toHaveURL(/\/panel\/datos$/, FIRST_VISIT);
  await page.getByRole("button", { name: t.logo.quitar }).click();
  await expect(
    page.getByRole("img", { name: t.logo.sinLogo }).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("button", { name: t.portada.quitar }).click();
  await expect(
    page.getByLabel(t.portada.agregar).filter({ visible: true }),
  ).toBeAttached(FIRST_VISIT);
  await expect
    .poll(async () => {
      const now = await shopProfileSnapshot(slug);
      return [now.logoObjects, now.coverObjects];
    })
    .toEqual([[], []]);
  expect(await shopProfileSnapshot(slug)).toMatchObject({
    logoPath: null,
    coverPath: null,
  });

  // The location can be removed too.
  await page.getByRole("button", { name: t.ubicacion.quitar }).click();
  await save(page);
  expect(await shopProfileSnapshot(slug)).toMatchObject({
    latitude: null,
    longitude: null,
    // The rest stays as it was.
    name: "Barbería El Parche Norte",
    locality: "San Fernando, Cali",
  });
});

test("D-57 refuses a WhatsApp that is not a Colombian mobile and saves nothing", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const slug = await signInSetUpOwner(page);
  await openData(page);
  await field(page, t.campos.direccion).fill("Calle 5 # 38-25");
  await field(page, t.campos.whatsapp).fill("601 234 5678");
  await page.getByRole("button", { name: t.guardar }).click();

  const whatsapp = field(page, t.campos.whatsapp);
  await expect(whatsapp).toHaveAccessibleDescription(t.errores.phone_invalid);
  await expect(whatsapp).toBeFocused();
  await expect(whatsapp).toHaveValue("601 234 5678");
  await expect(field(page, t.campos.direccion)).toHaveValue("Calle 5 # 38-25");
  await expect(page).toHaveURL(/\/panel\/datos$/);
  expect(await shopProfileSnapshot(slug)).toMatchObject({
    address: null,
    whatsappPhone: "+573001234567",
  });
});

test("D-57 reads well on a phone @ui", async ({ page }) => {
  test.setTimeout(120_000);
  await signInSetUpOwner(page);
  await page.goto("/panel/datos");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await checkScreen(page);
});
