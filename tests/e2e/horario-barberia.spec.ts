import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// Task 2.4a: the barbershop's hours (D-58). The wizard leaves the default
// hours: Mon-Fri 9-20 and Sat 8-21, Sunday closed.
const t = textos.horarioBarberia;
const h = textos.horario;
const b = textos.barberos;
const mas = textos.mas;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("horario-barberia");
  await createConfirmedOwner(email, PASSWORD, {
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
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// Next.js keeps the previous page mounted and hidden: getByRole only finds
// the visible one.
const day = (page: Page, name: string) => page.getByRole("group", { name });

// The Horario row of D-50, a link named by its content.
const hoursRow = (page: Page) =>
  page.getByRole("link", { name: new RegExp(`^${mas.horario}\\b`) });

// Kevin, with hours of his own: a copy of the barbershop's (Mon-Fri 9-20).
async function addKevinWithOwnHours(page: Page) {
  await page.goto("/panel/barberos/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: b.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("textbox", { name: b.campos.nombre }).fill("Kevin");
  await page.getByRole("button", { name: b.guardar, exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await page.getByRole("link", { name: /^Kevin\b/ }).click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  await page
    .getByRole("link", { name: new RegExp(`^${b.horario}\\b`) })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: h.titulo("Kevin") }),
  ).toBeVisible(FIRST_VISIT);
  // Visually hidden native input: its drawn switch takes the tap.
  await page
    .getByRole("switch", { name: h.usaBarberia })
    .uncheck({ force: true });
  await page.getByRole("button", { name: h.guardar }).click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
}

async function openShopHours(page: Page) {
  await page.goto("/panel/mas");
  await expect(
    page.getByRole("heading", { level: 1, name: mas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await hoursRow(page).click();
  await expect(page).toHaveURL(/\/panel\/horario$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

test("an owner changes the barbershop's hours and sees who falls outside", async ({
  page,
}) => {
  // The wizard and five screens, each compiled on first use.
  test.setTimeout(240_000);
  await signInSetUpOwner(page);
  await addKevinWithOwnHours(page);

  // D-50: the Horario row sums up the week and leads to D-58.
  await page.goto("/panel/mas");
  await expect(hoursRow(page)).toContainText(
    "Lun a vie 9:00 a. m. – 8:00 p. m. · Sáb 8:00 a. m. – 9:00 p. m.",
    FIRST_VISIT,
  );
  await openShopHours(page);

  // The seven days: Monday open 9-20, Sunday closed. Kevin fits.
  const monday = day(page, "Lunes");
  await expect(
    monday.getByRole("switch", { name: t.abre("Lunes") }),
  ).toBeChecked();
  await expect(monday.getByRole("combobox", { name: h.desde })).toHaveValue(
    "09:00",
  );
  const sunday = day(page, "Domingo");
  const sundaySwitch = sunday.getByRole("switch", { name: t.abre("Domingo") });
  await expect(sundaySwitch).not.toBeChecked();
  await expect(
    page.getByText(t.festivos).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(t.fuera(["Kevin"])).filter({ visible: true }),
  ).toHaveCount(0);
  await checkScreen(page);

  // Monday opens at 10:00 and Sunday opens 9-18.
  await monday.getByRole("combobox", { name: h.desde }).selectOption("10:00");
  await sundaySwitch.check({ force: true });
  await expect(sunday.getByRole("combobox", { name: h.hasta })).toHaveValue(
    "18:00",
  );
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/horario\?guardado=1$/, FIRST_VISIT);
  await expect(
    page.getByText(t.guardado).filter({ visible: true }),
  ).toBeVisible();

  // Kevin's own Monday starts at 9:00: his hours are kept, with a warning.
  await expect(
    page.getByText(t.fuera(["Kevin"])).filter({ visible: true }),
  ).toBeVisible();
  const kevinLink = page.getByRole("link", { name: h.titulo("Kevin") });
  await expect(kevinLink).toHaveAttribute(
    "href",
    /\/panel\/barberos\/[0-9a-f-]{36}\/horario$/,
  );
  await checkScreen(page);

  // Saved: a reload shows the new week, not the one before.
  await page.reload();
  await expect(
    day(page, "Lunes").getByRole("combobox", { name: h.desde }),
  ).toHaveValue("10:00", FIRST_VISIT);
  await expect(
    day(page, "Domingo").getByRole("switch", { name: t.abre("Domingo") }),
  ).toBeChecked();

  // Every day closed is refused, and nothing changes.
  for (const name of [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ]) {
    await day(page, name)
      .getByRole("switch", { name: t.abre(name) })
      .uncheck({ force: true });
  }
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: t.errores.hours_required }),
  ).toBeVisible(FIRST_VISIT);

  // Back in Más, the row sums up the saved week.
  await page.getByRole("link", { name: textos.ui.volver }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
  await expect(hoursRow(page)).toContainText("Lun 10:00 a. m. – 8:00 p. m.");
  await expect(hoursRow(page)).toContainText("Dom 9:00 a. m. – 6:00 p. m.");

  // Coming back, the editor starts from what was saved.
  await hoursRow(page).click();
  await expect(page).toHaveURL(/\/panel\/horario$/, FIRST_VISIT);
  await expect(
    day(page, "Lunes").getByRole("combobox", { name: h.desde }),
  ).toHaveValue("10:00");
  await expect(
    day(page, "Lunes").getByRole("switch", { name: t.abre("Lunes") }),
  ).toBeChecked();

  // The warning leads to Kevin's schedule.
  await page.getByRole("link", { name: h.titulo("Kevin") }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: h.titulo("Kevin") }),
  ).toBeVisible(FIRST_VISIT);
});
