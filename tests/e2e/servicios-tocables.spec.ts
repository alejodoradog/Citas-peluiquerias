import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop } from "./helpers/supabase";

// Task 7.10: on the public page (C-01), tapping a service starts the booking
// with that service already chosen; "Reservar cita" stays.
const t = textos.reservas;

test("tapping a service books it, already chosen", async ({ page }) => {
  test.setTimeout(90_000);
  const shop = await createBookableShop("servicios-tocables");
  await page.goto(`/${shop.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Barbería La Esquina" }),
  ).toBeVisible(FIRST_VISIT);

  const services = page.getByRole("region", { name: t.perfil.servicios });
  await expect(services.getByRole("link")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: t.perfil.reservar }),
  ).toHaveAttribute("href", `/${shop.slug}/reservar`);
  await expectAccessible(page);
  await expectTouchTargets(page);

  await services.getByRole("link", { name: /^Barba/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/${shop.slug}/reservar\\?servicios=${shop.services.barba}$`),
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: t.barbero.titulo }),
  ).toBeVisible(FIRST_VISIT);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/${shop.slug}$`));
  await expect(
    page
      .getByRole("region", { name: t.perfil.servicios })
      .filter({ visible: true })
      .getByRole("link", { name: /^Corte/ }),
  ).toHaveAttribute(
    "href",
    `/${shop.slug}/reservar?servicios=${shop.services.corte}`,
  );
});
