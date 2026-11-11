import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// Task 2.4e: changing the booking link (D-61). The old link keeps leading to
// the new one and no other barbershop can take it (decision P1 of 2.4).
const t = textos.link;
const mas = textos.mas;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page, prefix: string, name: string) {
  const email = uniqueEmail(prefix);
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: name,
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  await page
    .getByLabel(textos.cuentas.ingreso.campos.password)
    .filter({ visible: true })
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  return slug;
}

async function openLink(page: Page) {
  await page.goto("/panel/mas");
  await expect(
    page.getByRole("heading", { level: 1, name: mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("link", { name: new RegExp(`^${mas.link}`) }).click();
  await expect(page).toHaveURL(/\/panel\/link$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

const newLink = (page: Page) => page.getByRole("textbox", { name: t.nuevo });
const status = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

// Types a link and waits for what the line under the field says about it.
async function typeAndSee(page: Page, link: string, text: string) {
  await expect(async () => {
    await newLink(page).fill(link);
    await expect(status(page, text)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
}

test("an owner changes the link, and the old one leads to the new one", async ({
  page,
}) => {
  // The wizard twice and five screens, each compiled on first use.
  test.setTimeout(240_000);
  const name = "Barbería El Parche";
  const oldSlug = await signInSetUpOwner(page, "link", name);
  const newSlug = `${oldSlug}-norte`;
  await openLink(page);

  // Más stays mounted and hidden with the same link: only what is visible.
  await expect(
    page
      .getByText(`yapoin.com/${oldSlug}`, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(newLink(page)).toHaveValue(oldSlug);
  await expect(page.getByText(t.aviso)).toBeVisible();
  await expect(page.getByRole("button", { name: t.cambiar })).toBeDisabled();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // A link that cannot be one, then a free one. Typed again if the
  // development server remounted the form meanwhile (Strict Mode).
  await typeAndSee(page, "jl", t.errores.slug_invalid);
  await expect(page.getByRole("button", { name: t.cambiar })).toBeDisabled();
  await typeAndSee(page, newSlug, t.disponible);
  await expectAccessible(page);
  await page.getByRole("button", { name: t.cambiar }).click();

  await expect(page).toHaveURL(/\/panel\/link\?guardado=1$/, FIRST_VISIT);
  await expect(
    page.getByText(t.cambiado(`yapoin.com/${newSlug}`)).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);
  await expect(newLink(page)).toHaveValue(newSlug);

  // "Compartir el link nuevo" goes to D-62, with the new link.
  await page
    .getByRole("link", { name: t.compartir })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/panel\/compartir$/, FIRST_VISIT);
  await expect(
    page.getByText(`yapoin.com/${newSlug}`, { exact: true }).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);

  // Más shows it too.
  await page.goto("/panel/mas");
  await expect(
    page.getByText(`yapoin.com/${newSlug}`, { exact: true }).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);

  // The old link of the QR and the posters opens the barbershop's page.
  await page.goto(`/${oldSlug}`);
  await expect(page).toHaveURL(new RegExp(`/${newSlug}$`), FIRST_VISIT);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: textos.proximamente.reservas.titulo(name),
    }),
  ).toBeVisible(FIRST_VISIT);

  // Another barbershop cannot take the old link, nor the new one. A free
  // link in between, so each answer is a new one.
  await page.context().clearCookies();
  await signInSetUpOwner(page, "link-otro", "Barbería La Esquina");
  await openLink(page);
  await typeAndSee(page, oldSlug, t.errores.slug_taken);
  await expect(newLink(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: t.cambiar })).toBeDisabled();
  await typeAndSee(page, `${oldSlug}-sur`, t.disponible);
  await typeAndSee(page, newSlug, t.errores.slug_taken);
  await expect(page.getByRole("button", { name: t.cambiar })).toBeDisabled();
});
