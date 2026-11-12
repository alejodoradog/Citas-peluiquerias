import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";

// The links that already circulate. The booking link of the QR and the
// poster is the booking page now (tasks 3.2 and 3.3, reservar.spec.ts); a
// link that is no barbershop's is C-18. A barber's private link is "Mi
// agenda" now (task 4.4, barbero.spec.ts): a token that is no barber's gets
// B-05, the same for any token.
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

test("a barber's link that is no one's shows B-05, whatever the token", async ({
  page,
}) => {
  for (const token of ["a".repeat(43), "cualquier-cosa"]) {
    const response = await page.goto(`/b/${token}`);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: textos.barbero.vencido.titulo,
      }),
    ).toBeVisible(FIRST_VISIT);
  }
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
});
