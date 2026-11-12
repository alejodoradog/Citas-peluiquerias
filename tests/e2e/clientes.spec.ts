import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  createShopWithCustomers,
  customerSnapshot,
  signInOwner,
} from "./helpers/clientes";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";

// Task 4.3: D-40 Clientes, D-41 the customer's profile and D-42 "Borrar
// cliente" (Ley 1581). The customers come from helpers/clientes.ts.
const t = textos.clientes;
const FIRST_VISIT = { timeout: 20_000 };

test("D-40 lists, searches and filters the customers @ui", async ({ page }) => {
  test.setTimeout(90_000);
  const shop = await createShopWithCustomers("clientes-lista");
  await signInOwner(page, shop.owner);
  await page.goto("/panel/clientes");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(t.total(4), { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  // The rows of customers, not the filters: every row says its visits.
  const rows = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: /visita/ }) });
  await expect(rows).toHaveCount(4);
  // Alphabetical, with what each row says after the visits.
  await expect(rows.nth(0)).toContainText("Camila Rojas");
  await expect(rows.nth(1)).toContainText("Diego Prada");
  await expect(rows.nth(1)).toContainText(t.inasistencias(2));
  await expect(rows.nth(1)).toContainText(t.visitas(2));
  await expect(rows.nth(2)).toContainText(`${t.visitas(1)} · ${t.sinCorreo}`);
  await expect(rows.nth(3)).toContainText(t.proxima("", "").trim());
  await expect(rows.nth(3)).toContainText("4:00 p. m.");
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // The search ignores accents and case, and goes into the URL.
  const search = page.getByRole("searchbox", { name: t.buscar.etiqueta });
  await search.fill("velez");
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=velez/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Laura Vélez");

  // By the phone's digits, however they are typed.
  await search.fill("301 222");
  await search.press("Enter");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Diego Prada");

  // Nobody: the empty state offers the whole list again.
  await search.fill("nadie se llama así");
  await search.press("Enter");
  await expect(rows).toHaveCount(0);
  await expect(
    page
      .getByText(t.sinResultados.titulo, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: t.sinResultados.verTodos }).click();
  await expect(rows).toHaveCount(4);

  // Con inasistencias: Diego only.
  const filters = page.getByRole("navigation", { name: t.filtros.etiqueta });
  await filters.getByRole("link", { name: t.filtros.inasistencias }).click();
  await expect(page).toHaveURL(/[?&]filtro=inasistencias/);
  await expect(
    filters.getByRole("link", { name: t.filtros.inasistencias }),
  ).toHaveAttribute("aria-current", "true");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Diego Prada");

  // Nuevos: all four were created today.
  await filters.getByRole("link", { name: t.filtros.nuevos }).click();
  await expect(page).toHaveURL(/[?&]filtro=nuevos/);
  await expect(rows).toHaveCount(4);
});

test("D-41 shows the profile, the alert and the history, and saves the notes @ui", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const shop = await createShopWithCustomers("clientes-ficha");
  await signInOwner(page, shop.owner);
  await page.goto("/panel/clientes");
  await page
    .getByRole("link", { name: /Diego Prada/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/panel/clientes/${shop.customers.diego}$`),
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Diego Prada" }),
  ).toBeVisible(FIRST_VISIT);

  // Spec, "Inasistencias": 2 or more, an alert.
  const alert = page
    .getByRole("status")
    .filter({ hasText: t.inasistencias(2) });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("No llegó");

  const stats = page.getByRole("main").locator("dl").first();
  await expect(stats).toContainText("2");
  await expect(stats).toContainText("$65.000");
  await expect(
    page.getByText("diego.prada@correo.com", { exact: true }).filter({
      visible: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("301 222 3344", { exact: true }).filter({ visible: true }),
  ).toBeVisible();

  // The history, the latest first, with each state.
  const history = page.getByRole("main").getByRole("list");
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await expect(history.getByRole("listitem").first()).toContainText(
    t.ficha.estados.no_show,
  );
  await expect(
    history.getByText(t.ficha.estados.attended, { exact: true }),
  ).toHaveCount(2);
  await expect(history).toContainText("Corte + Barba · Ana");

  // "Nueva cita para Diego" opens the manual appointment of task 4.2 with
  // him chosen.
  await expect(
    page.getByRole("link", { name: t.ficha.nuevaCita("Diego Prada") }),
  ).toHaveAttribute(
    "href",
    `/panel/citas/nueva?cliente=${shop.customers.diego}`,
  );
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // The notes.
  const notes = page.getByRole("textbox", { name: t.ficha.notas.etiqueta });
  await expect(notes).toHaveValue("Prefiere a Ana.");
  await notes.fill("Prefiere a Ana. Degradado bajo.");
  await page.getByRole("button", { name: t.ficha.notas.guardar }).click();
  await expect(
    page.getByText(t.ficha.notas.guardadas, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: t.ficha.notas.etiqueta }),
  ).toHaveValue("Prefiere a Ana. Degradado bajo.", FIRST_VISIT);
  expect(
    (await customerSnapshot(shop.owner, shop.customers.diego)).customer?.notes,
  ).toBe("Prefiere a Ana. Degradado bajo.");
});

test("a customer with fewer than 2 no-shows has no alert", async ({ page }) => {
  test.setTimeout(90_000);
  const shop = await createShopWithCustomers("clientes-sin-alerta");
  await signInOwner(page, shop.owner);
  await page.goto(`/panel/clientes/${shop.customers.juan}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Juan Pérez" }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(t.ficha.sinCorreo, { exact: true }).filter({
      visible: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("No llegó")).toHaveCount(0);
});

test("D-42 deletes a customer, anonymizing them without losing an appointment @ui", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const shop = await createShopWithCustomers("clientes-borrar");
  await signInOwner(page, shop.owner);
  const before = await customerSnapshot(shop.owner, shop.customers.diego);
  expect(before.appointments).toHaveLength(4);

  // Not while an appointment is to come.
  await page.goto(`/panel/clientes/${shop.customers.laura}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Laura Vélez" }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("button", { name: t.borrar.boton }).click();
  let sheet = page.getByRole("dialog", {
    name: t.borrar.titulo("Laura Vélez"),
  });
  await sheet.getByRole("button", { name: t.borrar.confirmar }).click();
  await expect(
    sheet.getByText(t.borrar.errores.has_upcoming_appointments),
  ).toBeVisible();
  await sheet.getByRole("button", { name: t.borrar.volver }).click();
  await expect(sheet).toHaveCount(0);

  // Diego.
  await page.goto(`/panel/clientes/${shop.customers.diego}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Diego Prada" }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("button", { name: t.borrar.boton }).click();
  sheet = page.getByRole("dialog", { name: t.borrar.titulo("Diego Prada") });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(t.borrar.cuerpo);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await sheet.getByRole("button", { name: t.borrar.confirmar }).click();

  await expect(page).toHaveURL(/\/panel\/clientes\?borrado=1$/, FIRST_VISIT);
  await expect(
    page.getByText(t.borrado, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(t.total(3), { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Diego Prada/ }).filter({ visible: true }),
  ).toHaveCount(0);

  // Anonymized: no name, email, phone or notes, and the four appointments
  // are still there with their prices.
  const after = await customerSnapshot(shop.owner, shop.customers.diego);
  expect(after.customer).toMatchObject({
    full_name: t.clienteBorrado,
    email: null,
    phone: null,
    notes: null,
  });
  expect(after.customer?.anonymized_at).not.toBeNull();
  expect(after.appointments).toHaveLength(4);
  expect(after.appointments.map((a) => a.id).sort()).toEqual(
    before.appointments.map((a) => a.id).sort(),
  );

  // Their profile is gone.
  await page.goto(`/panel/clientes/${shop.customers.diego}`);
  await expect(
    page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
  ).toBeVisible(FIRST_VISIT);

  // Camila had no appointment: her row is really deleted.
  await page.goto(`/panel/clientes/${shop.customers.camila}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Camila Rojas" }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("button", { name: t.borrar.boton }).click();
  await page
    .getByRole("dialog", { name: t.borrar.titulo("Camila Rojas") })
    .getByRole("button", { name: t.borrar.confirmar })
    .click();
  await expect(page).toHaveURL(/\/panel\/clientes\?borrado=1$/, FIRST_VISIT);
  expect(
    (await customerSnapshot(shop.owner, shop.customers.camila)).customer,
  ).toBeNull();
});
