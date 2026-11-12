import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { createShopWithCustomers, signInOwner } from "./helpers/clientes";

// Task 4.3: D-40 to D-42 against the design (docs/diseno, copied from Claude
// Design on 2026-11-11) at 390 × 844, the way fidelidad.spec.ts measures the
// other screens: styles with 1 px of slack, both screenshots in the report.
// Its own file, so the agenda's screens (task 4.1) can grow the other one.
const PROPERTIES = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "line-height",
] as const;

type Property = (typeof PROPERTIES)[number];
type Styles = Record<Property, string>;

// An element found just before React's second mount in development is no
// longer in the page: it is looked up again until it is.
async function stylesOf(locator: Locator): Promise<Styles> {
  let styles: Styles | null = null;
  await expect
    .poll(
      async () => {
        styles = await locator.evaluate(
          (element, properties) => {
            if (!element.isConnected) return null;
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
        return styles !== null;
      },
      { timeout: 5_000 },
    )
    .toBe(true);
  return styles!;
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
  only: ReadonlyArray<Property> = PROPERTIES,
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

const TEXT = ["font-size", "font-weight", "color"] as const;
const BUTTON = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
] as const;
// A filter is a pill too: rounded-full against the design's 18 px draw the
// same at 36 px, so its radius is not compared.
const PILL = BUTTON.filter((property) => property !== "border-radius");
// A pill: 9999px against the design's 12 px draw the same at 24 px.
const CHIP = ["height", "background-color", "color", "font-size"] as const;

const t = textos.clientes;
const FIRST_VISIT = { timeout: 20_000 };

test("D-40 to D-42 match the design", async ({ page }) => {
  test.setTimeout(150_000);
  const shop = await createShopWithCustomers("fidelidad-clientes");
  await signInOwner(page, shop.owner);

  // D-40
  await page.goto("/panel/clientes");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  let design = await openDesign(page, "D40-Clientes.dc.html");
  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.locator("x-dc > div > div").first().locator("span").first(),
    TEXT,
  );
  await compare(
    "subtítulo de la barra",
    page.getByText(t.total(4), { exact: true }).filter({ visible: true }),
    design.getByText("128 clientes", { exact: true }),
    ["font-size", "color"],
  );
  // The border is darker on purpose, as every field's (founder, 2026-11-09).
  await compare(
    "búsqueda",
    page.getByRole("searchbox", { name: t.buscar.etiqueta }).locator(".."),
    design.locator("#cs").locator(".."),
    ["height", "border-radius", "background-color"],
  );
  await compare(
    "texto de la búsqueda",
    page.getByRole("searchbox", { name: t.buscar.etiqueta }),
    design.locator("#cs"),
    ["font-size", "color"],
  );
  await compare(
    "filtro elegido",
    page.locator("[data-filter=todos]").filter({ visible: true }),
    design.getByRole("button", { name: "Todos" }),
    PILL,
  );
  await compare(
    "filtro",
    page.locator("[data-filter=nuevos]").filter({ visible: true }),
    design.getByRole("button", { name: "Nuevos" }),
    PILL,
  );
  await compare(
    "nombre",
    page.getByText("Diego Prada", { exact: true }).filter({ visible: true }),
    design.getByText("Diego Prada", { exact: true }),
    TEXT,
  );
  await compare(
    "detalle",
    page
      .getByText(`${t.visitas(2)} · `, { exact: false })
      .filter({ visible: true })
      .first(),
    design.getByText("6 visitas · última: hoy", { exact: true }),
    ["font-size", "color", "line-height"],
  );
  await compare(
    "inasistencias",
    page
      .getByText(t.inasistencias(2), { exact: true })
      .filter({ visible: true }),
    design.getByText("2 inasistencias", { exact: true }),
    CHIP,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);
  await attachSideBySide(page, design, "D-40");
  await design.close();

  // D-41
  await page.goto(`/panel/clientes/${shop.customers.diego}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Diego Prada" }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D41-Ficha-cliente.dc.html");
  await compare(
    "nombre",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Diego Prada", { exact: true }),
    TEXT,
  );
  await compare(
    "desde",
    page.getByText(/^Cliente desde/).filter({ visible: true }),
    design.getByText("Cliente desde agosto 2026"),
    ["font-size", "color"],
  );
  await compare(
    "alerta",
    page.getByRole("status").filter({ hasText: "No llegó" }),
    design.locator("[role=status]"),
    ["background-color", "border-radius"],
  );
  await compare(
    "título de la alerta",
    page
      .getByRole("status")
      .filter({ hasText: "No llegó" })
      .getByText(t.inasistencias(2), { exact: true }),
    design.locator("[role=status] strong"),
    TEXT,
  );
  await compare(
    "número",
    page.getByText("$65.000", { exact: true }).filter({ visible: true }),
    design.getByText("$165.000", { exact: true }),
    TEXT,
  );
  await compare(
    "nombre del número",
    page
      .getByText(t.ficha.numeros.total, { exact: true })
      .filter({ visible: true }),
    design.getByText("En total", { exact: true }),
    ["font-size", "color"],
  );
  await compare(
    "dato",
    page
      .getByText("diego.prada@correo.com", { exact: true })
      .filter({ visible: true }),
    design.getByText("diego.prada@correo.com", { exact: true }),
    TEXT,
  );
  await compare(
    "etiqueta de las notas",
    page.locator("label", { hasText: t.ficha.notas.etiqueta }),
    design.locator("label[for=nt]"),
    TEXT,
  );
  await compare(
    "notas",
    page.getByRole("textbox", { name: t.ficha.notas.etiqueta }),
    design.locator("#nt"),
    ["border-radius", "background-color", "font-size", "color"],
  );
  await compare(
    "historial",
    page.getByRole("heading", { level: 2, name: t.ficha.historial }),
    design.getByRole("heading", { level: 2 }),
    TEXT,
  );
  await compare(
    "estado",
    page
      .getByText(t.ficha.estados.attended, { exact: true })
      .filter({ visible: true })
      .first(),
    design.getByText("Atendida", { exact: true }).first(),
    CHIP,
  );
  await compare(
    "nueva cita",
    page.getByRole("link", { name: t.ficha.nuevaCita("Diego Prada") }),
    design.getByRole("link", { name: "Nueva cita para Diego" }),
    BUTTON,
  );
  await attachSideBySide(page, design, "D-41");
  await design.close();

  // D-42
  await page.getByRole("button", { name: t.borrar.boton }).click();
  const sheet = page.getByRole("dialog", {
    name: t.borrar.titulo("Diego Prada"),
  });
  await expect(sheet).toBeVisible();
  design = await openDesign(page, "D42-Borrar-cliente.dc.html");
  await compare(
    "título",
    sheet.getByRole("heading", { level: 2 }),
    design.locator("[role=dialog] h2"),
    TEXT,
  );
  await compare(
    "cuerpo",
    sheet.getByText(t.borrar.cuerpo),
    design.locator("[role=dialog] p"),
    ["font-size", "line-height", "color"],
  );
  await compare(
    "borrar",
    sheet.getByRole("button", { name: t.borrar.confirmar }),
    design.getByRole("link", { name: "Borrar cliente" }),
    BUTTON,
  );
  await compare(
    "volver",
    sheet.getByRole("button", { name: t.borrar.volver }),
    design.locator("[role=dialog]").getByRole("link", { name: "Volver" }),
    BUTTON,
  );
  await attachSideBySide(page, design, "D-42");
  await design.close();
});
