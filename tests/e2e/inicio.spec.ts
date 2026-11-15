import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";

const t = textos.landing;

test("the landing shows the Spanish copy @ui", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(page.getByRole("heading", { name: t.titulo })).toBeVisible();
  await expect(page.getByText(t.bajada)).toBeVisible();
  await expect(page).toHaveTitle(textos.marca);
});

test("the landing shows the prices and the contact @ui", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: t.precios.abrir }).click();
  const prices = page.getByRole("dialog", { name: t.precios.titulo });
  for (const plan of t.precios.planes) {
    await expect(prices.getByText(plan.quien)).toBeVisible();
    await expect(prices.getByText(plan.valor)).toBeVisible();
  }
  await prices.getByRole("button", { name: textos.ui.cerrar }).click();

  await page.getByRole("button", { name: t.contacto.abrir }).click();
  const contact = page.getByRole("dialog", { name: t.contacto.titulo });
  await expect(
    contact.getByRole("link", { name: t.contacto.whatsapp }),
  ).toHaveAttribute(
    "href",
    `https://wa.me/573229381101?text=${encodeURIComponent(t.contacto.mensaje)}`,
  );
  await expect(
    contact.getByRole("link", { name: t.contacto.correo }),
  ).toHaveAttribute("href", `mailto:${t.contacto.correo}`);
  await expect(contact.getByText(t.contacto.donde)).toBeVisible();
});

test("the landing sends to sign up, and the app opens /app", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/app.webmanifest",
  );
  const manifest = await (await page.request.get("/app.webmanifest")).json();
  expect(manifest.start_url).toBe("/app");

  await page.getByRole("link", { name: t.crearCuenta }).click();
  await expect(page).toHaveURL(/\/registro$/, { timeout: 20_000 });
});

test("'Añadir la app' shows this phone's steps on /app", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: t.instalar.boton }).click();
  await expect(page).toHaveURL(/\/app\?instalar=1$/, { timeout: 20_000 });
  const steps = page.getByRole("dialog", { name: t.instalar.titulo });
  // The android project runs on a Pixel.
  await expect(steps.getByText(t.instalar.android[1]!)).toBeVisible();
  await steps.getByRole("button", { name: t.instalar.listo }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("a barbershop's page carries no app manifest", async ({ page }) => {
  await page.goto("/terminos");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
});
