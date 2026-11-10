import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// Task 2.5: the owner shares the booking link from D-62 (Compartir): copy
// and share it, download its QR and a poster, and copy a message ready to
// send. Owners are created already confirmed, so no email is sent.
const t = textos.compartir;
const card = textos.ui.linkReservas;
const nav = textos.ui.navegacion;
const PASSWORD = "clave-segura-1";
const BARBERSHOP = "Barbería El Parche";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signIn(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: BARBERSHOP,
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  // A password field has no ARIA role, so it goes by its label, among the
  // visible fields only.
  await page
    .getByLabel(textos.cuentas.ingreso.campos.password)
    .filter({ visible: true })
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  return { slug };
}

async function signInSetUpOwner(page: Page, tag: string) {
  const owner = await signIn(page, tag);
  await finishSetup(page);
  return owner;
}

async function openShare(page: Page) {
  await page
    .getByRole("navigation", { name: nav.etiqueta })
    .getByRole("link", { name: nav.compartir })
    .click();
  await expect(page).toHaveURL(/\/panel\/compartir$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// Width and height of a PNG, from its IHDR chunk.
async function pngSize(path: string) {
  const bytes = await readFile(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("an owner shares the booking link from D-62", async ({
  page,
  context,
}) => {
  // The wizard and a new screen; the dev server compiles each page once.
  test.setTimeout(120_000);
  const { slug } = await signInSetUpOwner(page, "compartir");
  const link = `https://yapoin.com/${slug}`;
  const message = t.mensaje(BARBERSHOP, `yapoin.com/${slug}`);

  await openShare(page);
  await expect(
    page
      .getByRole("navigation", { name: nav.etiqueta })
      .getByRole("link", { name: nav.compartir }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(t.subtitulo)).toBeVisible();
  await expect(page.getByText(t.bajada)).toBeVisible();
  // The link also ends the message, so the card's is the exact match; D-14
  // may still be mounted and hidden with the same link.
  await expect(
    page
      .getByText(`yapoin.com/${slug}`, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: textos.ui.qr.etiqueta }),
  ).toBeVisible();
  await expect(page.getByText(t.qrTitulo, { exact: true })).toBeVisible();
  // Next.js keeps the previous page mounted and hidden: only visible text.
  await expect(
    page.getByText(BARBERSHOP, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: t.texto.titulo }),
  ).toBeVisible();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: card.compartir }),
  ).toBeVisible();
  // The wizard left a barber ("Yo también corto"): no warning.
  await expect(page.getByText(textos.asistente.listo.sinBarberos)).toHaveCount(
    0,
  );
  await checkScreen(page);

  if (test.info().project.name === "android") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: card.copiar, exact: true }).click();
    await expect(page.getByText(card.copiado)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      link,
    );

    await page.getByRole("button", { name: t.texto.copiar }).click();
    await expect(page.getByText(t.texto.copiado)).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      message,
    );
  }

  const qr = page.waitForEvent("download");
  await page.getByRole("button", { name: t.descargarQr }).click();
  const qrFile = await qr;
  expect(qrFile.suggestedFilename()).toBe(`qr-yapoin-${slug}.png`);
  expect(await pngSize(await qrFile.path())).toEqual({
    width: 1024,
    height: 1024,
  });

  const poster = page.waitForEvent("download");
  await page.getByRole("button", { name: t.afiche }).click();
  const posterFile = await poster;
  expect(posterFile.suggestedFilename()).toBe(`afiche-yapoin-${slug}.png`);
  // A letter page at 150 dpi (P1 of task 2.5).
  expect(await pngSize(await posterFile.path())).toEqual({
    width: 1275,
    height: 1650,
  });
  await expect(page.getByText(t.falloAfiche)).toHaveCount(0);
});

test("D-62 warns when no barber can take bookings yet", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, "compartir-sin-barberos");

  // The wizard, finished later without barbers.
  await expect(page).toHaveURL(/\/panel\/configurar$/, FIRST_VISIT);
  await page
    .getByRole("link", { name: textos.asistente.servicios.continuar })
    .click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, FIRST_VISIT);
  await page
    .getByRole("checkbox", {
      name: new RegExp(textos.asistente.equipo.yoCorto),
    })
    // Visually hidden native input: its drawn box takes the tap.
    .uncheck({ force: true });
  await page
    .getByRole("button", { name: textos.asistente.equipo.despues })
    .click();
  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, FIRST_VISIT);

  await page.goto("/panel/compartir");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(textos.asistente.listo.sinBarberos),
  ).toBeVisible();
  // The link still works for copying and printing ahead of time.
  await expect(page.getByRole("button", { name: t.afiche })).toBeVisible();
  await checkScreen(page);
});

test("D-62 and D-50 meet the F-01 rules @ui", async ({ page }) => {
  test.setTimeout(120_000);
  await signInSetUpOwner(page, "compartir-ui");

  await openShare(page);
  await expect(page.getByRole("button", { name: t.afiche })).toBeVisible();
  // No way back: Compartir is a section of the bottom bar.
  await expect(page.getByRole("link", { name: textos.ui.volver })).toHaveCount(
    0,
  );
  await checkScreen(page);

  // D-50 now has the same top bar; signing out stays in "Tu cuenta".
  await page
    .getByRole("navigation", { name: nav.etiqueta })
    .getByRole("link", { name: nav.mas })
    .click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: textos.mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(BARBERSHOP, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: textos.cuentas.salir })
      .filter({ visible: true }),
  ).toHaveCount(1);
  await checkScreen(page);
});
