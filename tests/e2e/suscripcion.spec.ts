import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  formatBogotaDayMonth,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { signInOwner } from "./helpers/clientes";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  createBookableShop,
  setExpiresOn,
  suspendBarbershop,
} from "./helpers/supabase";

// Task 5.5: the subscription notice on top of the agenda, and a paused
// barbershop that is read only.
const t = textos.suscripcion;
const day = (date: string) => formatBogotaDayMonth(startOfBogotaDay(date));

function notice(page: Page, title: string) {
  return page
    .getByRole("status")
    .or(page.getByRole("alert"))
    .filter({ hasText: title, visible: true });
}

test("the agenda warns before the end, during the grace and once paused", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("suscripcion");
  const today = toBogotaDate(new Date());

  // D-70: the trial ends in two days.
  const soon = addDays(today, 2);
  await setExpiresOn(shop.id, soon);
  await signInOwner(page, shop.owner);
  const expiring = notice(page, t.vencePrueba(day(soon)));
  await expect(expiring).toBeVisible(FIRST_VISIT);
  await expect(expiring).toContainText(t.pago.sinValor);

  // D-71: it ended two days ago; bookings go on for five days.
  const ended = addDays(today, -2);
  await setExpiresOn(shop.id, ended);
  await page.reload();
  const grace = notice(page, t.vencida(day(ended)));
  await expect(grace).toBeVisible(FIRST_VISIT);
  await expect(grace).toContainText(t.reservasHasta(day(addDays(ended, 5))));

  // D-72: the sixth day pauses it.
  await setExpiresOn(shop.id, addDays(today, -6));
  await page.reload();
  const paused = notice(page, t.pausada);
  await expect(paused).toBeVisible(FIRST_VISIT);
  await expect(paused).toContainText(t.pausadaDetalle);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
});

test("a suspended barbershop keeps its data but saves no change", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("suscripcion-pausada");
  await suspendBarbershop(shop.id);
  await signInOwner(page, shop.owner);
  await expect(notice(page, t.pausada)).toBeVisible(FIRST_VISIT);

  // "Comisión de los barberos" (task 4.6) says why it did not save.
  const cierre = textos.cierre;
  await page.goto("/panel/cierre");
  // Picking a percentage saves it at once (D-64).
  await page
    .getByRole("combobox", { name: cierre.comision })
    .selectOption("40");
  await expect(
    page.getByRole("alert").filter({ hasText: t.soloLectura }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("combobox", { name: cierre.comision }),
  ).toHaveValue("0");
});
