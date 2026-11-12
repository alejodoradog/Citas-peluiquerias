import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";

// The local seed (supabase/seed.sql) creates these accounts with one shared
// password. See docs/operacion/datos-de-prueba.md.
const SEED_PASSWORD = "barberia-local-1";
const t = textos.cuentas;

async function signIn(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel(t.ingreso.campos.email).fill(email);
  await page.getByLabel(t.ingreso.campos.password).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: t.ingreso.enviar }).click();
}

test("the seed owner signs in to their barbershop", async ({ page }) => {
  await signIn(page, "carlos@barberias.test");

  await expect(page).toHaveURL(/\/panel$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(`^${textos.agenda.hoy("")}`),
    }),
  ).toBeVisible();
  await expect(
    page.getByText("La Barbería del Barrio", { exact: true }),
  ).toBeVisible();
});

test("the seed super admin signs in to the platform panel", async ({
  page,
}) => {
  await signIn(page, "admin@barberias.test");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: textos.admin.titulo }),
  ).toBeVisible();
});
