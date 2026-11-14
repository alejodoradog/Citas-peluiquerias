import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { seedAppointment } from "./helpers/agenda";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop, signedInClient } from "./helpers/supabase";

// Task 4.6: "Cierre del día" (D-64). The owner opens it from Más, goes to
// yesterday, sets the barbers' commission and downloads the CSV.
const t = textos.cierre;

async function signIn(page: Page, owner: { email: string; password: string }) {
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(owner.email);
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.password })
    .fill(owner.password);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
}

const visibleText = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

test("the owner reads the day close, sets the commission and downloads it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("cierre");
  const { ana, beto } = shop.barbers;
  const { corte, barba } = shop.services;
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const { data: customer } = await owner
    .from("customers")
    .insert({ barbershop_id: shop.id, full_name: "Cliente Cierre" })
    .select("id")
    .single();
  const yesterday = addDays(toBogotaDate(new Date()), -1);
  const at = (time: string) => fromBogota(yesterday, time);
  const seed = (
    barberId: string,
    time: string,
    serviceIds: string[],
    status: "attended" | "no_show" | "confirmed",
  ) =>
    seedAppointment({
      barbershopId: shop.id,
      customerId: customer!.id,
      barberId,
      startsAt: at(time),
      serviceIds,
      status,
    });
  await seed(ana, "10:00", [corte, barba], "attended");
  await seed(beto, "11:00", [corte], "attended");
  await seed(ana, "12:00", [corte], "no_show");
  await seed(beto, "13:00", [corte], "confirmed");

  await signIn(page, shop.owner);
  await page.goto("/panel/mas");
  await page.getByRole("link", { name: new RegExp(t.titulo) }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // Yesterday: Corte + Barba with Ana, Corte with Beto, one no-show and one
  // still confirmed.
  await page.getByRole("link", { name: t.anterior }).click();
  await expect(page).toHaveURL(new RegExp(`dia=${yesterday}`), FIRST_VISIT);
  await expect(visibleText(page, "$65.000")).toBeVisible();
  await expect(visibleText(page, t.atendidos(2))).toBeVisible();
  await expect(visibleText(page, t.atendidos(1))).toBeVisible();
  // No commission until the owner picks one (decision C1).
  await expect(visibleText(page, t.sinComision).first()).toBeVisible();

  await page.getByRole("combobox", { name: t.comision }).selectOption("40");
  await expect(page).toHaveURL(/guardado=1/, FIRST_VISIT);
  await expect(visibleText(page, t.comisionDe("$16.000", 40))).toBeVisible();
  await expect(visibleText(page, t.comisionDe("$10.000", 40))).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: t.descargar }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(t.csv.archivo(yesterday));
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Ana;2;40000;16000");
  expect(csv).toContain("Beto;1;25000;10000");
  expect(csv).toContain(`${t.csv.total};3;65000;26000`);
});
