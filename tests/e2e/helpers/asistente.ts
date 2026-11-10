import { expect, type Page } from "@playwright/test";
import { textos } from "../../../src/ui/textos";

const t = textos.asistente;

// A new owner lands on the setup wizard. This accepts the suggestions and
// finishes it, so a test can go on to the panel. The dev server compiles
// each page the first time it is opened, hence the longer waits.
export async function finishSetup(page: Page) {
  await expect(page).toHaveURL(/\/panel\/configurar$/, { timeout: 20_000 });
  await page.getByRole("link", { name: t.servicios.continuar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: t.equipo.terminar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, {
    timeout: 20_000,
  });
  await page.getByRole("link", { name: t.listo.agenda }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
  // The agenda streams its greeting once it knows the setup is done. Waiting
  // for it lets any navigation still in flight settle, so the next
  // page.goto() is not interrupted by it.
  await expect(
    page
      .getByRole("heading", {
        level: 1,
        name: new RegExp(`^${textos.panel.saludo("")}`),
      })
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/panel$/);
}
