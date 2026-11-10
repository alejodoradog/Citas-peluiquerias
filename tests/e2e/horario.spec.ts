import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { createConfirmedOwner, uniqueEmail } from "./helpers/supabase";

// Task 2.2c: a barber's own hours (D-55), inside the barbershop's. The wizard
// leaves the default hours: Mon-Fri 9-20 and Sat 8-21, Sunday closed.
const t = textos.barberos;
const h = textos.horario;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("horario");
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

// A barber row is one link named by its content ("Kevin Horario de …").
const barberRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

// The Horario row of D-54, a link named by its content.
const hoursRow = (page: Page) =>
  page.getByRole("link", { name: new RegExp(`^${t.horario}\\b`) });

// Next.js keeps the previous page mounted and hidden: getByRole only finds
// the visible one.
const day = (page: Page, name: string) => page.getByRole("group", { name });

async function openSchedule(page: Page) {
  await barberRow(page, "Kevin").click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  await hoursRow(page).click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}\/horario$/,
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: h.titulo("Kevin") }),
  ).toBeVisible(FIRST_VISIT);
}

async function saveSchedule(page: Page) {
  await page.getByRole("button", { name: h.guardar }).click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Kevin" }),
  ).toBeVisible(FIRST_VISIT);
}

async function backToTeam(page: Page) {
  await page.getByRole("link", { name: textos.ui.cerrar }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
}

test("an owner gives a barber their own hours and puts them back on the barbershop's", async ({
  page,
}) => {
  // The wizard and four screens, each compiled on first use.
  test.setTimeout(180_000);
  await signInSetUpOwner(page);

  // A new barber "Kevin", on the barbershop's hours.
  await page.goto("/panel/barberos/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: t.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("textbox", { name: t.campos.nombre }).fill("Kevin");
  await page.getByRole("button", { name: t.guardar, exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await expect(barberRow(page, "Kevin")).toContainText(t.horarioBarberia);

  // D-54 → D-55: the barbershop's hours, summarized under the switch.
  await openSchedule(page);
  const usesShop = page.getByRole("switch", { name: h.usaBarberia });
  await expect(usesShop).toBeChecked();
  await expect(
    page
      .getByText(
        "Lun a vie 9:00 a. m. – 8:00 p. m. · Sáb 8:00 a. m. – 9:00 p. m.",
      )
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(day(page, "Lunes")).toHaveCount(0);
  await checkScreen(page);

  // Off: the week starts as a copy of the barbershop's.
  // Visually hidden native input: its drawn switch takes the tap.
  await usesShop.uncheck({ force: true });
  const monday = day(page, "Lunes");
  await expect(
    monday.getByRole("switch", { name: h.trabaja("Lunes") }),
  ).toBeChecked();
  await expect(monday.getByRole("combobox", { name: h.desde })).toHaveValue(
    "09:00",
  );
  await expect(monday.getByRole("combobox", { name: h.hasta })).toHaveValue(
    "20:00",
  );
  const sunday = day(page, "Domingo");
  await expect(
    sunday.getByRole("switch", { name: h.trabaja("Domingo") }),
  ).not.toBeChecked();
  await checkScreen(page);

  // Monday split, its morning out of the barbershop's hours (6:00-8:00).
  await monday.getByRole("button", { name: h.partirDia("Lunes") }).click();
  const morning = monday.getByRole("group", { name: h.tramos[0] });
  const afternoon = monday.getByRole("group", { name: h.tramos[1] });
  await morning.getByRole("combobox", { name: h.desde }).selectOption("06:00");
  await morning.getByRole("combobox", { name: h.hasta }).selectOption("08:00");
  await afternoon
    .getByRole("combobox", { name: h.desde })
    .selectOption("14:00");
  await afternoon
    .getByRole("combobox", { name: h.hasta })
    .selectOption("18:00");
  await page.getByRole("button", { name: h.guardar }).click();
  await expect(
    monday.getByText(h.errores.hours_outside_shop).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    monday.getByText(h.barberiaAbre("9:00 a. m. – 8:00 p. m."), {
      exact: false,
    }),
  ).toBeVisible();
  await expect(morning.getByRole("combobox", { name: h.desde })).toBeFocused();
  await expect(page).toHaveURL(/\/horario$/);
  await checkScreen(page);

  // Fixed: Monday 9:00-12:00 and 14:00-18:00, Sunday off.
  await morning.getByRole("combobox", { name: h.desde }).selectOption("09:00");
  await morning.getByRole("combobox", { name: h.hasta }).selectOption("12:00");
  await saveSchedule(page);
  await expect(hoursRow(page)).toContainText(
    "Lun 9:00 a. m. – 12:00 p. m., 2:00 p. m. – 6:00 p. m.",
  );
  await backToTeam(page);
  await expect(barberRow(page, "Kevin")).toContainText(t.horarioPropio);

  // The saved week comes back as it was.
  await openSchedule(page);
  await expect(usesShop).not.toBeChecked();
  await expect(
    day(page, "Lunes")
      .getByRole("group", { name: h.tramos[1] })
      .getByRole("combobox", { name: h.desde }),
  ).toHaveValue("14:00");
  await expect(
    day(page, "Domingo").getByRole("switch", { name: h.trabaja("Domingo") }),
  ).not.toBeChecked();

  // Back on the barbershop's hours.
  await usesShop.check({ force: true });
  await expect(day(page, "Lunes")).toHaveCount(0);
  await saveSchedule(page);
  await expect(hoursRow(page)).toContainText(t.horarioBarberia);
  await backToTeam(page);
  await expect(barberRow(page, "Kevin")).toContainText(t.horarioBarberia);
});

test("a schedule link that leads nowhere is not found", async ({ page }) => {
  test.setTimeout(90_000);
  await signInSetUpOwner(page);
  for (const id of ["no-existe", "00000000-0000-0000-0000-000000000000"]) {
    await page.goto(`/panel/barberos/${id}/horario`);
    await expect(
      page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
    ).toBeVisible(FIRST_VISIT);
  }
});
