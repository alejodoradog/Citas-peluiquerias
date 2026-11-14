import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  createBookableShop,
  createSuperAdmin,
  uniqueEmail,
} from "./helpers/supabase";

// Task 5.4: the platform panel. The super admin finds a barbershop (P-01),
// opens it (P-02), registers a payment (P-03), voids it, extends the trial
// (P-04), suspends it (P-05) and reactivates it, and reads the numbers
// (P-06). Only the super admin gets there (cuentas.spec.ts).
const t = textos.plataforma;
const PASSWORD = "clave-segura-1";

async function signInAsAdmin(page: Page) {
  const email = uniqueEmail("plataforma-admin");
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

const visibleText = (page: Page, text: string) =>
  page.getByText(text).filter({ visible: true });

test("the super admin finds a barbershop and manages its subscription", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const name = `Barbería Plataforma ${Date.now().toString(36)}`;
  const shop = await createBookableShop("plataforma", name);
  await signInAsAdmin(page);

  // P-01: the owner's email finds it.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(t.titulo);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
  const search = page.getByRole("searchbox", { name: t.buscar.etiqueta });
  await search.fill(shop.owner.email);
  await search.press("Enter");
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole("link", { name: new RegExp(name) }),
  ).toBeVisible();

  // The trial filter keeps it.
  await page
    .getByRole("link", { name: new RegExp(`^${t.filtros.prueba}`) })
    .click();
  await expect(page).toHaveURL(/estado=prueba/);
  await page.getByRole("link", { name: new RegExp(name) }).click();

  // P-02.
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, shop.owner.email)).toBeVisible();
  await expect(visibleText(page, t.estados.trial).first()).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  // P-03: one month at the plan's price.
  await page.getByRole("link", { name: t.ficha.registrarPago }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.pago.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
  await page
    .getByRole("combobox", { name: t.pago.medio })
    .selectOption("nequi");
  await page
    .getByRole("textbox", { name: t.pago.referencia })
    .fill("NEQ-E2E-1");
  await expect(visibleText(page, t.pago.quedaHasta)).toBeVisible();
  await page.getByRole("button", { name: t.pago.enviar }).click();
  await expect(visibleText(page, t.ficha.hecho.pago)).toBeVisible(FIRST_VISIT);
  await expect(
    visibleText(page, t.ficha.pagoDetalle("NEQ-E2E-1")),
  ).toBeVisible();
  await expect(visibleText(page, t.estados.active).first()).toBeVisible();

  // Voiding it, with a reason (decision P4): back to the trial.
  await page.getByRole("button", { name: /^Anular el pago/ }).click();
  await page
    .getByRole("textbox", { name: t.anular.motivo })
    .fill("Pago duplicado");
  await page.getByRole("button", { name: t.anular.enviar }).click();
  await expect(visibleText(page, t.ficha.hecho.anulado)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    visibleText(page, t.ficha.anulado("Pago duplicado")),
  ).toBeVisible();
  await expect(visibleText(page, t.estados.trial).first()).toBeVisible();

  // P-04.
  await page.getByRole("button", { name: t.ficha.extender }).click();
  await page.getByRole("combobox", { name: t.extender.dias }).selectOption("7");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: t.extender.enviar })
    .click();
  await expect(visibleText(page, t.ficha.hecho.extendida)).toBeVisible(
    FIRST_VISIT,
  );

  // P-05, then Reactivar (decision P5).
  await page.getByRole("button", { name: t.ficha.suspender }).click();
  await page.getByRole("button", { name: t.suspender.enviar }).click();
  await expect(visibleText(page, t.ficha.hecho.suspendida)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, t.estados.suspended).first()).toBeVisible();
  await page.getByRole("button", { name: t.ficha.reactivar }).click();
  await page.getByRole("button", { name: t.reactivar.enviar }).click();
  await expect(visibleText(page, t.ficha.hecho.reactivada)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, t.estados.trial).first()).toBeVisible();

  // P-06.
  await page.goto("/admin/metricas");
  await expect(
    page.getByRole("heading", { level: 1, name: t.metricas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(visibleText(page, t.metricas.ingresoMes)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
});
