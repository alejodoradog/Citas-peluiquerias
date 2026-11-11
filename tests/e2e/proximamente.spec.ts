import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// The links that already circulate, before their pages exist: the booking
// link of the QR and the poster (task 3.2) and a barber's private link
// (task 4.4) say they are on their way instead of "not found".
const t = textos.proximamente;
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

test("the booking link says booking is on its way, with the barbershop's name", async ({
  page,
}) => {
  const barbershop = "Barbería El Parche";
  const { slug } = await createConfirmedOwner(
    uniqueEmail("proximamente"),
    "clave-segura-1",
    { ownerName: "Carlos Pérez", barbershopName: barbershop },
  );
  await page.goto(`/${slug}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t.reservas.titulo(barbershop),
    }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByText(t.reservas.bajada)).toBeVisible();
  await expect(
    page.getByRole("link", { name: t.conoceYapoin }),
  ).toHaveAttribute("href", "/");
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
});

test("a link that is no barbershop's is not found", async ({ page }) => {
  await page.goto("/no-existe-esta-barberia-xyz");
  await expect(
    page.getByRole("heading", { level: 1, name: /Muy pronto/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
  ).toBeVisible(FIRST_VISIT);
});

test("a barber's link says the agenda is on its way, whatever the token", async ({
  page,
}) => {
  for (const token of ["a".repeat(43), "cualquier-cosa"]) {
    const response = await page.goto(`/b/${token}`);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      page.getByRole("heading", { level: 1, name: t.barbero.titulo }),
    ).toBeVisible(FIRST_VISIT);
  }
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
});
