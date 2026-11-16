import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  createBookableShop,
  createSuperAdmin,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.12: the platform panel on a computer (from 1024 px): the side menu,
// the sortable table of P-01, the sheet and the charts of the metrics.
const t = textos.plataforma;
const PASSWORD = "clave-segura-1";

test.use({ viewport: { width: 1280, height: 800 } });

async function signInAsAdmin(page: Page) {
  const email = uniqueEmail("plataforma-escritorio");
  await createSuperAdmin(email, PASSWORD);
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.password })
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await expect(page).toHaveURL(/\/admin$/, FIRST_VISIT);
}

test("the super admin works the platform panel on a computer", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);
  const prefix = `Escritorio ${stamp}`;
  const nameA = `${prefix} Alfa`;
  const nameB = `${prefix} Beta`;
  await createBookableShop("escritorio-a", nameA);
  await createBookableShop("escritorio-b", nameB);
  await signInAsAdmin(page);

  // P-01: menu and table.
  const menu = page.getByRole("navigation", { name: t.menu.etiqueta });
  await expect(menu).toBeVisible(FIRST_VISIT);
  await expect(
    menu.getByRole("link", { name: t.menu.establecimientos }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    menu.getByRole("link", { name: t.menu.metricas }),
  ).not.toHaveAttribute("aria-current", "page");

  const search = page.getByRole("searchbox", { name: t.buscar.etiqueta });
  await search.fill(prefix);
  await search.press("Enter");
  await expect(page).toHaveURL(/q=/, FIRST_VISIT);

  const table = page.getByRole("table");
  await expect(table).toBeVisible(FIRST_VISIT);
  for (const column of Object.values(t.tabla.columnas)) {
    await expect(
      table.getByRole("columnheader", { name: column }),
    ).toBeVisible();
  }
  // The phone list stays hidden: only the table's link is reachable.
  await expect(page.getByRole("link", { name: new RegExp(nameA) })).toHaveCount(
    1,
  );
  await expect(page.locator("ul.lg\\:hidden")).toBeHidden();

  await expectAccessible(page);
  await expectTouchTargets(page);

  const rows = table.getByRole("row").filter({ hasText: prefix });
  await expect(rows).toHaveCount(2);
  const header = table.getByRole("columnheader", {
    name: t.tabla.columnas.nombre,
  });

  await header.getByRole("link").click();
  await expect(page).toHaveURL(/orden=nombre(&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(rows.first()).toContainText(nameA);
  await expect(rows.last()).toContainText(nameB);

  await header.getByRole("link").click();
  await expect(page).toHaveURL(/orden=-nombre(&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows.first()).toContainText(nameB);
  await expect(rows.last()).toContainText(nameA);

  // P-02: the name opens the sheet.
  await table.getByRole("link", { name: new RegExp(nameA) }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: nameA }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: t.ficha.registrarPago }),
  ).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  // P-06: the metrics from the menu.
  await menu.getByRole("link", { name: t.menu.metricas }).click();
  await expect(page).toHaveURL(/\/admin\/metricas$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: t.metricas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    menu.getByRole("link", { name: t.menu.metricas }),
  ).toHaveAttribute("aria-current", "page");
  for (const title of [
    t.metricas.registros.titulo,
    t.metricas.citas.titulo,
    t.metricas.ingresos.titulo,
  ]) {
    await expect(page.getByRole("region", { name: title })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { level: 2, name: t.metricas.porTipo.titulo }),
  ).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  // "Ver tabla": 12 rows of data, and the button turns into "Ver gráfico".
  const chart = page.getByRole("region", { name: t.metricas.registros.titulo });
  await chart.getByRole("button", { name: t.metricas.verTabla }).click();
  await expect(
    chart.getByRole("button", { name: t.metricas.verGrafico }),
  ).toHaveAttribute("aria-pressed", "true");
  const dataRows = chart.getByRole("table").locator("tbody tr");
  await expect(dataRows).toHaveCount(12);
  await expect(chart.getByRole("table")).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
});
