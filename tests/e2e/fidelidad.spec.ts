import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";

// Task 2.0: the app against the design (docs/diseno, copied from Claude
// Design on 2026-11-09) at 390 × 844. Measured styles, with 1 px of slack,
// instead of pixel diffs that break with fonts. The design opens without
// JavaScript: its files are data. Both screenshots go to the report for the
// founder's review.
const PROPERTIES = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "line-height",
] as const;

type Styles = Record<(typeof PROPERTIES)[number], string>;

async function stylesOf(locator: Locator): Promise<Styles> {
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
  only: ReadonlyArray<(typeof PROPERTIES)[number]> = PROPERTIES,
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

const t = textos.cuentas.registro;

test("D-02 matches the design", async ({ page }) => {
  await page.goto("/registro");
  const design = await openDesign(page, "D02-Registro.dc.html");

  await compare(
    "título",
    page.getByRole("heading", { level: 1 }),
    design.locator("h1"),
    ["font-size", "font-weight", "line-height", "color"],
  );
  await compare(
    "etiqueta",
    page.locator("label", { hasText: t.campos.ownerName }),
    design.locator("label[for=r1]"),
    ["font-size", "font-weight", "color"],
  );
  // The border color differs on purpose: darker for contrast (founder, 2026-11-09).
  await compare(
    "campo",
    page.getByLabel(t.campos.ownerName),
    design.locator("#r1"),
    ["height", "border-radius", "background-color", "font-size", "color"],
  );
  await compare(
    "ayuda",
    page.getByText(t.ayudas.phone),
    design.getByText("Será también el WhatsApp"),
    ["font-size", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: t.enviar }),
    design.getByRole("link", { name: "Crear cuenta", exact: true }),
    [
      "height",
      "border-radius",
      "background-color",
      "color",
      "font-size",
      "font-weight",
    ],
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-02");
  await design.close();
});

test("D-01 matches the design", async ({ page }) => {
  await page.goto("/");
  const design = await openDesign(page, "D01-Inicio.dc.html");

  await compare(
    "título",
    page.getByRole("heading", { level: 1 }),
    design.locator("h1"),
    ["font-size", "font-weight", "line-height", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("link", { name: textos.inicio.crearCuenta }),
    design.getByRole("link", { name: "Crear cuenta gratis" }),
    [
      "height",
      "border-radius",
      "background-color",
      "color",
      "font-size",
      "font-weight",
    ],
  );
  await compare(
    "botón secundario",
    page.getByRole("link", { name: textos.inicio.ingresar, exact: true }),
    design.getByRole("link", { name: "Ingresar", exact: true }),
    [
      "height",
      "border-radius",
      "background-color",
      "color",
      "font-size",
      "font-weight",
    ],
  );

  await attachSideBySide(page, design, "D-01");
  await design.close();
});

test("D-05 matches the design", async ({ page }) => {
  await page.goto("/ingresar?confirmado=1");
  const design = await openDesign(page, "D05-Ingresar.dc.html");

  await compare(
    "aviso de éxito",
    page
      .getByRole("status")
      .filter({ hasText: textos.cuentas.ingreso.correoConfirmado.titulo }),
    design.locator('[role="status"]'),
    ["border-radius", "background-color"],
  );
  await compare(
    "título del aviso",
    page.getByText(textos.cuentas.ingreso.correoConfirmado.titulo),
    design.getByText("Listo, tu correo quedó confirmado."),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "campo",
    page.getByLabel(textos.cuentas.ingreso.campos.email),
    design.locator("#i1"),
    ["height", "border-radius", "background-color", "font-size", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: textos.cuentas.ingreso.enviar }),
    design.getByRole("link", { name: "Ingresar", exact: true }),
    [
      "height",
      "border-radius",
      "background-color",
      "color",
      "font-size",
      "font-weight",
    ],
  );
  await compare(
    "link de recuperar",
    page.getByRole("link", { name: textos.cuentas.ingreso.olvidaste }),
    design.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
    ["font-size", "font-weight", "color"],
  );

  await attachSideBySide(page, design, "D-05");
  await design.close();
});
