import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  fromBogota,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import {
  holidayWindow,
  upcomingHolidays,
} from "../../src/modulos/barberias/dominio/holidays";
import {
  closureTitle,
  holidayDay,
} from "../../src/app/(panel)/panel/horario/festivos/closure-text";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  createConfirmedOwner,
  holidayOpenings,
  shopClosures,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.4c: holidays and closures (D-59). Dates come from the real clock,
// in Bogotá, as the screen computes them.
const t = textos.festivos;
const hb = textos.horarioBarberia;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("festivos");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await page.goto("/ingresar");
  await page.getByLabel(textos.cuentas.ingreso.campos.email).fill(email);
  await page.getByLabel(textos.cuentas.ingreso.campos.password).fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  return slug;
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// D-58 › Festivos y cierres especiales, a link named by its content.
async function openHolidays(page: Page) {
  await page.goto("/panel/horario");
  await expect(
    page.getByRole("heading", { level: 1, name: hb.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("link", { name: new RegExp(`^${hb.festivos}`) }).click();
  await expect(page).toHaveURL(/\/panel\/horario\/festivos$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

// The sheets are modal dialogs on the current page: inside them nothing of
// the hidden previous page can match. Date inputs have no ARIA role, so the
// dates are found by their label within the sheet.
const sheet = (page: Page) => page.getByRole("dialog", { name: t.hoja.titulo });

test("an owner opens a holiday of the next 12 months", async ({ page }) => {
  test.setTimeout(150_000);
  const slug = await signInSetUpOwner(page);
  await openHolidays(page);

  const today = toBogotaDate(new Date());
  const window = holidayWindow(today);
  const holidays = upcomingHolidays(window.from, window.until);
  const first = holidays[0]!;
  const last = holidays.at(-1)!;

  // Every holiday of the window, closed by default.
  const firstSwitch = page.getByRole("switch", {
    name: holidayDay(first.date),
  });
  await expect(firstSwitch).not.toBeChecked();
  await expect(firstSwitch).toHaveAccessibleDescription(
    t.nombres[first.keys[0]!],
  );
  await expect(
    page.getByRole("switch", { name: holidayDay(last.date) }),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(holidays.length);
  await checkScreen(page);

  // Open the first one.
  await firstSwitch.check({ force: true });
  await page.getByRole("button", { name: t.guardar, exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/horario\/festivos\?guardado=1$/);
  await expect(
    page.getByText(t.guardado).filter({ visible: true }),
  ).toBeVisible();
  expect(await holidayOpenings(slug)).toEqual([first.date]);
  await expect(
    page.getByRole("switch", { name: holidayDay(first.date) }),
  ).toBeChecked();

  // And close it again.
  await page
    .getByRole("switch", { name: holidayDay(first.date) })
    .uncheck({ force: true });
  await page.getByRole("button", { name: t.guardar, exact: true }).click();
  await expect
    .poll(() => holidayOpenings(slug), { timeout: 10_000 })
    .toEqual([]);
});

test("an owner adds closures of the whole barbershop and removes one", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const slug = await signInSetUpOwner(page);
  await openHolidays(page);

  // No closures yet.
  await expect(
    page.getByText(t.sinCierres).filter({ visible: true }),
  ).toBeVisible();
  await checkScreen(page);

  const today = toBogotaDate(new Date());
  const inventory = addDays(today, 3);
  const halfDay = addDays(today, 4);

  // A whole day, the sheet's default.
  await page.getByRole("button", { name: t.agregar }).click();
  await expect(sheet(page)).toBeVisible();
  await expect(
    sheet(page).getByRole("switch", { name: t.hoja.todoElDia }),
  ).toBeChecked();
  await checkScreen(page);
  await sheet(page).getByLabel(t.hoja.desdeFecha).fill(inventory);
  await sheet(page).getByLabel(t.hoja.hastaFecha).fill(inventory);
  await sheet(page)
    .getByRole("textbox", { name: new RegExp(`^${t.hoja.motivo}`) })
    .fill("Inventario");
  await sheet(page).getByRole("button", { name: t.hoja.guardar }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(
    page.getByText(t.agregado).filter({ visible: true }),
  ).toBeVisible();
  const wholeDay = closureTitle(
    startOfBogotaDay(inventory),
    startOfBogotaDay(addDays(inventory, 1)),
  );
  await expect(
    page.getByText(wholeDay, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText(`${t.todaLaBarberia} · Inventario`, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();

  // One that ends before it starts is refused, with the reason.
  await page.getByRole("button", { name: t.agregar }).click();
  await sheet(page).getByLabel(t.hoja.desdeFecha).fill(halfDay);
  await sheet(page).getByLabel(t.hoja.hastaFecha).fill(inventory);
  await sheet(page).getByRole("button", { name: t.hoja.guardar }).click();
  await expect(
    sheet(page).getByText(t.hoja.errores.closure_order),
  ).toBeVisible();

  // From 2:00 p. m. to the end of the day.
  await sheet(page).getByLabel(t.hoja.hastaFecha).fill(halfDay);
  await sheet(page)
    .getByRole("switch", { name: t.hoja.todoElDia })
    .uncheck({ force: true });
  await sheet(page)
    .getByRole("combobox", { name: t.hoja.desdeHora })
    .selectOption("14:00");
  await expect(
    sheet(page).getByRole("combobox", { name: t.hoja.hastaHora }),
  ).toHaveValue("24:00");
  await sheet(page).getByRole("button", { name: t.hoja.guardar }).click();
  await expect(sheet(page)).toBeHidden();
  const afternoon = closureTitle(
    fromBogota(halfDay, "14:00"),
    startOfBogotaDay(addDays(halfDay, 1)),
  );
  await expect(
    page.getByText(afternoon, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await checkScreen(page);

  expect(await shopClosures(slug)).toEqual([
    {
      startsAt: startOfBogotaDay(inventory).toISOString(),
      endsAt: startOfBogotaDay(addDays(inventory, 1)).toISOString(),
      reason: "Inventario",
    },
    {
      startsAt: fromBogota(halfDay, "14:00").toISOString(),
      endsAt: startOfBogotaDay(addDays(halfDay, 1)).toISOString(),
      reason: null,
    },
  ]);

  // Removing asks first; cancelling keeps it.
  await page.getByRole("button", { name: t.borrar(wholeDay) }).click();
  const confirm = page.getByRole("dialog", { name: t.confirmar.titulo });
  await expect(confirm).toBeVisible();
  await checkScreen(page);
  await confirm.getByRole("button", { name: t.confirmar.no }).click();
  await expect(confirm).toBeHidden();
  expect(await shopClosures(slug)).toHaveLength(2);

  await page.getByRole("button", { name: t.borrar(wholeDay) }).click();
  await confirm.getByRole("button", { name: t.confirmar.si }).click();
  await expect(confirm).toBeHidden();
  await expect(
    page.getByText(wholeDay, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  expect(await shopClosures(slug)).toEqual([
    expect.objectContaining({ reason: null }),
  ]);
});
