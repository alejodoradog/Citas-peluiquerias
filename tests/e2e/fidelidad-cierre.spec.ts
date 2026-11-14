import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { seedAppointment } from "./helpers/agenda";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop, signedInClient } from "./helpers/supabase";

// Task 4.6: "Cierre del día" against D-64 at 390 × 844, as
// tests/e2e/fidelidad.spec.ts does for the rest of the app: measured styles
// with 1 px of slack, and both screenshots in the report. Its own file, as
// docs/trabajo-en-paralelo.md asks.
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

const t = textos.cierre;
const TEXT = ["font-size", "font-weight", "color"] as const;

test("D-64 matches the design", async ({ page }) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("fidelidad-cierre");
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const { data: customer } = await owner
    .from("customers")
    .insert({ barbershop_id: shop.id, full_name: "Cliente Fidelidad" })
    .select("id")
    .single();
  const yesterday = addDays(toBogotaDate(new Date()), -1);
  await seedAppointment({
    barbershopId: shop.id,
    customerId: customer!.id,
    barberId: shop.barbers.ana,
    startsAt: fromBogota(yesterday, "10:00"),
    serviceIds: [shop.services.corte],
    status: "attended",
  });

  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(shop.owner.email);
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.password })
    .fill(shop.owner.password);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);

  await page.goto(`/panel/cierre?dia=${yesterday}`);
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  const design = await openDesign(page, "D64-Cierre-dia.dc.html");
  await compare(
    "título",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Cierre del día", { exact: true }).first(),
    ["font-size", "font-weight"],
  );
  await compare(
    "total",
    page.getByText("$25.000", { exact: true }).first(),
    design.getByText("$385.000", { exact: true }),
    TEXT,
  );
  await compare(
    "etiqueta",
    page.getByText(t.totalAtendido, { exact: true }),
    design.getByText("Total atendido", { exact: true }),
    ["font-size", "color"],
  );
  await compare(
    "barbero",
    page.getByText("Ana", { exact: true }),
    design.getByText("Andrés", { exact: true }),
    ["font-weight"],
  );
  await compare(
    "comisión",
    page.getByRole("combobox", { name: t.comision }),
    design.locator("#cd1"),
    ["height", "border-radius", "background-color"],
  );
  await compare(
    "descargar",
    page.getByRole("link", { name: t.descargar }),
    design.getByRole("button", { name: /Descargar resumen/ }),
    ["height", "background-color", "color", "font-weight"],
  );
  await attachSideBySide(page, design, "D-64");
  await design.close();
});
