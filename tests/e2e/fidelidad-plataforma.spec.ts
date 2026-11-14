import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  createBookableShop,
  createSuperAdmin,
  uniqueEmail,
} from "./helpers/supabase";

// Task 5.4: the platform panel (P-01 to P-06) against the design
// (docs/diseno) at 390 × 844, as tests/e2e/fidelidad.spec.ts does for the
// rest of the app: measured styles with 1 px of slack, and both screenshots
// in the report. Its own file, as docs/trabajo-en-paralelo.md asks.
const PROPERTIES = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
] as const;
type Property = (typeof PROPERTIES)[number];
type Styles = Record<Property, string>;

async function stylesOf(locator: Locator): Promise<Styles> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  return locator.evaluate(
    (element, properties) => {
      const style = getComputedStyle(element);
      const height = `${Math.round(element.getBoundingClientRect().height)}px`;
      return Object.fromEntries(
        properties.map((p) => [
          p,
          p === "height" ? height : style.getPropertyValue(p),
        ]),
      ) as Styles;
    },
    PROPERTIES as unknown as string[],
  );
}

function close(a: string, b: string): boolean {
  const x = parseFloat(a);
  const y = parseFloat(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return a === b;
  return Math.abs(x - y) <= 1;
}

async function compare(
  name: string,
  app: Locator,
  design: Locator,
  only: readonly Property[],
) {
  const [ours, theirs] = await Promise.all([stylesOf(app), stylesOf(design)]);
  for (const property of only) {
    expect
      .soft(
        close(ours[property], theirs[property]),
        `${name} ${property}: app ${ours[property]}, diseño ${theirs[property]}`,
      )
      .toBe(true);
  }
}

async function openDesign(page: Page, file: string) {
  const design = await page
    .context()
    .browser()!
    .newPage({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
  await design.goto(
    pathToFileURL(join(process.cwd(), "docs", "diseno", file)).href,
  );
  return design;
}

async function attachSideBySide(page: Page, design: Page, id: string) {
  await test.info().attach(`${id} app`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await test.info().attach(`${id} diseño`, {
    body: await design.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

const t = textos.plataforma;
const TEXT = ["font-size", "font-weight", "color"] as const;
const PASSWORD = "clave-segura-1";

test("P-01 to P-06 match the design", async ({ page }) => {
  test.setTimeout(180_000);
  const name = `Barbería Fidelidad ${Date.now().toString(36)}`;
  const shop = await createBookableShop("fidelidad-plataforma", name);
  const email = uniqueEmail("fidelidad-admin");
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

  // P-01
  await page.goto(`/admin?q=${encodeURIComponent(shop.owner.email)}`);
  let design = await openDesign(page, "P01-Barberias.dc.html");
  await compare(
    "título",
    page.getByText(t.titulo, { exact: true }).first(),
    design.getByText("Barberías", { exact: true }),
    TEXT,
  );
  await compare(
    "buscar",
    page.getByRole("search"),
    design.locator("div:has(> #ps)"),
    ["height", "border-radius", "background-color"],
  );
  await compare(
    "filtro elegido",
    page.getByRole("link", { name: /^Todas/ }),
    design.getByRole("button", { name: /^Todas/ }),
    ["background-color", "color", "font-size", "font-weight"],
  );
  await compare(
    "barbería",
    page.getByText(name, { exact: true }),
    design.getByText("Barbería La Esquina", { exact: true }),
    TEXT,
  );
  await compare(
    "estado",
    page.getByText(t.estados.trial, { exact: true }).first(),
    design.getByText("En prueba", { exact: true }).nth(1),
    ["height", "background-color", "color", "font-size", "font-weight"],
  );
  await attachSideBySide(page, design, "P-01");
  await design.close();

  // P-02
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible(
    FIRST_VISIT,
  );
  design = await openDesign(page, "P02-Ficha.dc.html");
  await compare(
    "dato",
    page.getByText(t.ficha.dueno, { exact: true }),
    design.getByText("Dueño", { exact: true }),
    ["font-size", "color"],
  );
  await compare(
    "valor",
    page.getByText(shop.owner.email, { exact: true }),
    design.getByText("[CORREO DEL DUEÑO]"),
    TEXT,
  );
  await compare(
    "registrar pago",
    page.getByRole("link", { name: t.ficha.registrarPago }),
    design.getByRole("link", { name: "Registrar pago" }),
    ["height", "background-color", "color", "font-weight"],
  );
  await compare(
    "suspender",
    page.getByRole("button", { name: t.ficha.suspender }),
    design.getByRole("link", { name: "Suspender", exact: true }),
    ["background-color", "color", "font-weight"],
  );
  await attachSideBySide(page, design, "P-02");
  await design.close();

  // P-05, a sheet over P-02.
  await page.getByRole("button", { name: t.ficha.suspender }).click();
  design = await openDesign(page, "P05-Suspender.dc.html");
  await compare(
    "suspender ahora",
    page.getByRole("button", { name: t.suspender.enviar }),
    design.getByRole("link", { name: "Suspender ahora" }),
    ["height", "background-color", "color", "font-weight"],
  );
  await attachSideBySide(page, design, "P-05");
  await design.close();
  await page.keyboard.press("Escape");

  // P-04, a sheet over P-02.
  await page.getByRole("button", { name: t.ficha.extender }).click();
  design = await openDesign(page, "P04-Extender.dc.html");
  await compare(
    "días extra",
    page.getByRole("combobox", { name: t.extender.dias }),
    design.locator("#ex1"),
    ["height", "border-radius", "background-color"],
  );
  await attachSideBySide(page, design, "P-04");
  await design.close();
  await page.keyboard.press("Escape");

  // P-03
  await page.getByRole("link", { name: t.ficha.registrarPago }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.pago.titulo }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "P03-Registrar-pago.dc.html");
  await compare(
    "etiqueta",
    page.locator("label", { hasText: t.pago.referencia }),
    design.getByText("Referencia del comprobante"),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "registrar y activar",
    page.getByRole("button", { name: t.pago.enviar }),
    design.getByRole("link", { name: "Registrar y activar" }),
    ["height", "background-color", "color", "font-weight"],
  );
  await attachSideBySide(page, design, "P-03");
  await design.close();

  // P-06
  await page.goto("/admin/metricas");
  await expect(
    page.getByRole("heading", { level: 1, name: t.metricas.titulo }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "P06-Metricas.dc.html");
  await compare(
    "ingreso",
    page.getByText(t.metricas.ingresoMes, { exact: true }),
    design.getByText("Ingreso del mes", { exact: true }),
    ["font-size", "color"],
  );
  await attachSideBySide(page, design, "P-06");
  await design.close();
});
