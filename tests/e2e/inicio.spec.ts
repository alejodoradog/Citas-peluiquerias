import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";

test("home page shows the Spanish copy", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(
    page.getByRole("heading", { name: textos.inicio.titulo }),
  ).toBeVisible();
  await expect(page.getByText(textos.inicio.descripcion)).toBeVisible();
});
