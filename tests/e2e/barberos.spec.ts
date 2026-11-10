import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  barberPhotos,
  createConfirmedOwner,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.2b: the owner manages the team from Más (D-53 and D-54), photos
// included. Owners are created already confirmed, so no email is sent.
const t = textos.barberos;
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

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("barberos");
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
  // Corte, Barba and Cejas, done by the owner ("Yo también corto").
  await finishSetup(page);
  return { slug };
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// A barber row is one link named by its content ("Kevin Horario de …").
const barberRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

const storagePhoto =
  /\/storage\/v1\/object\/public\/images\/[0-9a-f-]{36}\/barbers\/[0-9a-f-]{36}\.(webp|jpg)$/;

async function openBarber(page: Page, name: string) {
  await barberRow(page, name).click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible(
    FIRST_VISIT,
  );
}

async function save(page: Page) {
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
}

test("an owner adds a barber with a photo, replaces it, removes it and deactivates them", async ({
  page,
}) => {
  // A long flow through the wizard and three new screens; the dev server
  // compiles each page on first use.
  test.setTimeout(180_000);
  const { slug } = await signInSetUpOwner(page);

  // D-50 → D-53: the owner is the only barber, without a link.
  await page
    .getByRole("navigation", { name: textos.ui.navegacion.etiqueta })
    .getByRole("link", { name: textos.ui.navegacion.mas })
    .click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  await page
    .getByRole("link", { name: new RegExp(`^${mas.barberos}`) })
    .click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible();
  const owner = barberRow(page, "Carlos Pérez");
  await expect(owner).toContainText(t.tu);
  await expect(owner).toContainText(t.sinLink);
  await checkScreen(page);

  // D-54, new: every service checked, the notices off until there is an email.
  await page.getByRole("link", { name: t.agregar }).first().click();
  await expect(page).toHaveURL(/\/panel\/barberos\/nuevo$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.nuevo }),
  ).toBeVisible();
  for (const service of ["Corte", "Barba", "Cejas"]) {
    await expect(page.getByRole("checkbox", { name: service })).toBeChecked();
  }
  const notices = page.getByRole("switch", { name: t.avisos });
  await expect(notices).toBeDisabled();
  await checkScreen(page);

  await page.getByLabel(t.campos.nombre).fill("Kevin");
  await page.getByLabel(t.campos.correo).fill("kevin@correo.com");
  await page
    .getByLabel(t.foto.agregar)
    .setInputFiles(png("kevin.png", RED_PIXEL));
  await expect(page.getByText(t.foto.lista)).toBeVisible(FIRST_VISIT);
  // Visually hidden native input: its drawn switch takes the tap.
  await notices.check({ force: true });
  await save(page);

  const kevin = barberRow(page, "Kevin");
  await expect(kevin).toContainText(t.horarioBarberia);
  await expect(kevin).toContainText(t.conteoServicios(3));
  await expect(kevin).toContainText(t.linkActivo);
  await expect(kevin.locator("img")).toHaveAttribute("src", storagePhoto);
  const first = await barberPhotos(slug, "Kevin");
  expect(first.objects).toEqual([first.photoPath]);

  // D-54, edit: the saved photo shows; a new one replaces it and the old file
  // is deleted.
  await openBarber(page, "Kevin");
  await expect(page.locator("main img")).toHaveAttribute("src", storagePhoto);
  await expect(page.getByLabel(t.campos.correo)).toHaveValue(
    "kevin@correo.com",
  );
  await expect(notices).toBeChecked();
  await checkScreen(page);
  await page
    .getByLabel(t.foto.cambiar)
    .setInputFiles(png("kevin-2.png", GREY_PIXEL));
  await expect(page.getByText(t.foto.lista)).toBeVisible(FIRST_VISIT);
  await save(page);
  const second = await barberPhotos(slug, "Kevin");
  expect(second.photoPath).not.toBeNull();
  expect(second.photoPath).not.toBe(first.photoPath);
  expect(second.objects).toEqual([second.photoPath]);

  // "Quitar foto" deletes it at once: no file and no photo left.
  await openBarber(page, "Kevin");
  await page.getByRole("button", { name: t.foto.quitar }).click();
  await expect(page.getByLabel(t.foto.agregar)).toBeAttached(FIRST_VISIT);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect
    .poll(async () => (await barberPhotos(slug, "Kevin")).objects)
    .toEqual([]);
  expect((await barberPhotos(slug, "Kevin")).photoPath).toBeNull();

  // Notices without an email: explained on the email, which gets the focus.
  await page.getByLabel(t.campos.correo).fill("");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page.getByText(t.errores.notifications_need_email)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(page.getByLabel(t.campos.correo)).toBeFocused();
  await checkScreen(page);
  await notices.uncheck({ force: true });
  await save(page);

  // Deactivate, after confirming: Kevin moves to "Inactivos".
  await openBarber(page, "Kevin");
  await page.getByRole("button", { name: t.desactivar("Kevin") }).click();
  const sheet = page.getByRole("dialog", {
    name: t.confirmar.titulo("Kevin"),
  });
  await expect(sheet).toContainText(t.confirmar.cuerpo);
  await checkScreen(page);
  await sheet.getByRole("button", { name: t.confirmar.si("Kevin") }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 2, name: t.inactivos }),
  ).toBeVisible();
  await expect(barberRow(page, "Kevin")).toContainText(t.inactivo);
  await expect(barberRow(page, "Kevin")).toContainText("Se fue el");
  await checkScreen(page);

  // And back.
  await openBarber(page, "Kevin");
  await page.getByRole("button", { name: t.reactivar("Kevin") }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 2, name: t.inactivos }),
  ).toHaveCount(0);
  await expect(barberRow(page, "Kevin")).toContainText(t.linkActivo);

  // Más counts both active barbers.
  await page.getByRole("link", { name: textos.ui.volver }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${mas.barberos}`) }),
  ).toContainText(mas.conteoBarberos(2));
});

test("the owner cannot deactivate themselves", async ({ page }) => {
  test.setTimeout(120_000);
  await signInSetUpOwner(page);
  await page.goto("/panel/barberos");
  await openBarber(page, "Carlos Pérez");
  await expect(page.getByRole("button", { name: /^Desactivar/ })).toHaveCount(
    0,
  );
  await expect(page.getByText(t.linkDueno)).toBeVisible();
});

test("a barber link that leads nowhere is not found", async ({ page }) => {
  test.setTimeout(90_000);
  await signInSetUpOwner(page);
  for (const id of ["no-existe", "00000000-0000-0000-0000-000000000000"]) {
    await page.goto(`/panel/barberos/${id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
    ).toBeVisible(FIRST_VISIT);
  }
});
