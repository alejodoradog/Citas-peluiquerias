import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";

// The links that already circulate. The booking link of the QR and the
// poster is the booking page now (tasks 3.2 and 3.3, reservar.spec.ts); a
// link that is no barbershop's is C-18. A professional's old private link
// (/b/<token>, task 4.4) is gone since task 7.6c: whatever comes after /b/,
// the page says it no longer works and sends to the sign-in, without asking
// the database.
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

test("a link that is no barbershop's is not found", async ({ page }) => {
  await page.goto("/no-existe-esta-barberia-xyz");
  await expect(
    page.getByRole("heading", { level: 1, name: /Muy pronto/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: textos.reservas.noExiste.titulo,
    }),
  ).toBeVisible(FIRST_VISIT);
});

test("an old link of a professional says it no longer works, whatever comes after /b/", async ({
  page,
}) => {
  const old = textos.barbero.linkViejo;
  for (const path of [
    `/b/${"a".repeat(43)}`,
    "/b/cualquier-cosa",
    `/b/${"a".repeat(43)}/citas/00000000-0000-4000-8000-000000000000`,
    `/b/${"a".repeat(43)}/bloquear`,
  ]) {
    const response = await page.goto(path);
    // The old token stays out of any cache, Referer or search engine.
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      page.getByRole("heading", { level: 1, name: old.titulo }),
    ).toBeVisible(FIRST_VISIT);
    await expect(page.getByText(old.detalle)).toBeVisible();
    await expect(
      page.getByRole("link", { name: old.ingresar }),
    ).toHaveAttribute("href", "/ingresar");
  }
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
});
