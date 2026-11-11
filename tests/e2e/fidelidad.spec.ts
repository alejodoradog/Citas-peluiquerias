import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addDays,
  fromBogota,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  createConfirmedOwner,
  insertShopClosure,
  uniqueEmail,
} from "./helpers/supabase";

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

// The development server mounts every component twice (React's Strict
// Mode), so FreshOnReturn remounts the form of D-57 and D-58 right after the
// page loads. An element found just before that is no longer in the page and
// has no styles (empty strings): it is looked up again until it is.
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

test("D-62 matches the design", async ({ page }) => {
  // The wizard first, so the owner reaches the panel.
  test.setTimeout(120_000);
  const email = uniqueEmail("fidelidad-compartir");
  const password = "clave-segura-1";
  const { slug } = await createConfirmedOwner(email, password, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería La Esquina",
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  await page
    .getByLabel(textos.cuentas.ingreso.campos.password)
    .filter({ visible: true })
    .fill(password);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  await page.goto("/panel/compartir");
  const c = textos.compartir;
  await expect(
    page.getByRole("heading", { level: 1, name: c.titulo }),
  ).toBeVisible({ timeout: 20_000 });
  const design = await openDesign(page, "D62-Compartir.dc.html");

  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.locator("x-dc > div > div").first().locator("span").first(),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "subtítulo de la barra",
    page.getByText(c.subtitulo, { exact: true }),
    design.getByText("Tu link de reservas", { exact: true }),
    ["font-size", "color"],
  );
  await compare(
    "bajada",
    page.getByText(c.bajada),
    design.getByText("Ponlo en tu Instagram"),
    ["font-size", "line-height", "color"],
  );
  await compare(
    "link",
    page.getByText(`yapoin.com/${slug}`, { exact: true }),
    design.locator("strong").first(),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", {
      name: textos.ui.linkReservas.copiar,
      exact: true,
    }),
    design.getByRole("button", { name: "Copiar", exact: true }),
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
    page.getByRole("button", { name: c.afiche }),
    design.getByRole("button", { name: "Afiche" }),
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
    "bloque del QR",
    page.getByRole("img", { name: textos.ui.qr.etiqueta }).locator(".."),
    design.locator('[role="img"]').locator(".."),
    ["border-radius", "background-color"],
  );
  await compare(
    "QR",
    page.getByRole("img", { name: textos.ui.qr.etiqueta }),
    design.locator('[role="img"]'),
    ["height", "border-radius", "background-color"],
  );
  await compare(
    "leyenda del QR",
    page.getByText(c.qrTitulo, { exact: true }),
    design.getByText("Reserva tu cita aquí", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "título del texto",
    page.getByRole("heading", { level: 2, name: c.texto.titulo }),
    design.getByText("Texto listo para enviar", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "texto listo",
    page.getByText(c.mensaje("Barbería La Esquina", `yapoin.com/${slug}`)),
    design.getByText("¡Ya puedes reservar tu cita"),
    ["border-radius", "background-color", "color", "font-size", "line-height"],
  );
  await compare(
    "pestaña activa",
    page.locator('nav a[aria-current="page"]'),
    design.locator('nav a[aria-current="page"]'),
    ["color", "font-size", "font-weight"],
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-62");
  await design.close();
});

// An owner past the wizard, signed in, for the panel's screens.
async function signInReadyOwner(page: Page, prefix: string) {
  const email = uniqueEmail(prefix);
  const password = "clave-segura-1";
  const { slug } = await createConfirmedOwner(email, password, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería La Esquina",
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  await page
    .getByLabel(textos.cuentas.ingreso.campos.password)
    .filter({ visible: true })
    .fill(password);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  return slug;
}

const primaryButton = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
] as const;

test("D-58 matches the design", async ({ page }) => {
  test.setTimeout(120_000);
  await signInReadyOwner(page, "fidelidad-horario");
  await page.goto("/panel/horario");
  const hb = textos.horarioBarberia;
  await expect(
    page.getByRole("heading", { level: 1, name: hb.titulo }),
  ).toBeVisible({ timeout: 20_000 });
  const design = await openDesign(page, "D58-Horario-barberia.dc.html");

  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Horario de la barbería", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "bajada",
    page.getByText(hb.bajada),
    design.getByText("Los barberos trabajan dentro de este horario"),
    ["font-size", "line-height", "color"],
  );
  // The week's card. Its rows differ on purpose: the seven days are open to
  // edit, as in D-55 (docs/tareas/2.4-configuracion.md).
  await compare(
    "tarjeta de la semana",
    page.getByRole("group", { name: "Lunes" }).locator(".."),
    design.getByText("Lunes", { exact: true }).locator("../.."),
    ["border-radius", "background-color"],
  );
  await compare(
    "festivos",
    page.getByText(hb.festivos, { exact: true }),
    design.getByText("Festivos y cierres especiales", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "detalle de festivos",
    page.getByText(hb.festivosDetalle, { exact: true }),
    design.getByText("Festivos cerrados, salvo los que abras", { exact: true }),
    ["font-size", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: hb.guardar }),
    design.getByRole("link", { name: "Guardar horario" }),
    primaryButton,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-58");
  await design.close();
});

test("D-60 matches the design", async ({ page }) => {
  test.setTimeout(120_000);
  await signInReadyOwner(page, "fidelidad-politicas");
  await page.goto("/panel/reservas");
  const p = textos.politicas;
  await expect(
    page.getByRole("heading", { level: 1, name: p.titulo }),
  ).toBeVisible({ timeout: 20_000 });
  const design = await openDesign(page, "D60-Politicas.dc.html");

  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Reservas y cancelaciones", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  // A native select instead of the design's button with a sheet
  // (docs/tareas/2.4-configuracion.md); it is drawn the same.
  await compare(
    "selector",
    page.getByRole("combobox", { name: p.anticipacion }),
    design.locator("#po1"),
    ["height", "border-radius", "background-color", "font-size", "color"],
  );
  await compare(
    "etiqueta",
    page.getByText(p.anticipacion, { exact: true }),
    design.getByText("Anticipación mínima para reservar", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "ayuda",
    page.getByText(p.anticipacionAyuda, { exact: true }),
    design.getByText("Nadie puede reservar para dentro de menos tiempo.", {
      exact: true,
    }),
    ["font-size", "color"],
  );
  await compare(
    "dato fijo",
    page.getByText(p.ventanaValor(30), { exact: true }),
    design.getByText("30 días hacia adelante", { exact: true }),
    ["font-size", "font-weight", "line-height", "color"],
  );
  await compare(
    "aviso",
    page.getByRole("status").filter({ hasText: p.siempre }),
    design.locator('[role="status"]'),
    ["border-radius", "background-color"],
  );
  await compare(
    "título del aviso",
    page.getByText(p.siempre, { exact: true }),
    design.getByText("Tú siempre puedes cancelar o cambiar", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: p.guardar, exact: true }),
    design.getByRole("link", { name: "Guardar", exact: true }),
    primaryButton,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-60");
  await design.close();
});

test("D-57 matches the design", async ({ page }) => {
  test.setTimeout(120_000);
  await signInReadyOwner(page, "fidelidad-datos");
  await page.goto("/panel/datos");
  const d = textos.datos;
  await expect(
    page.getByRole("heading", { level: 1, name: d.titulo }),
  ).toBeVisible({ timeout: 20_000 });
  const design = await openDesign(page, "D57-Datos-barberia.dc.html");

  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Datos y fotos", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  // "Barbería La Esquina" without a logo: the initials LE, as the design.
  await compare(
    "logo",
    page.getByRole("img", { name: d.logo.sinLogo }),
    design.locator('[aria-label="Logo actual"]'),
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
    "portada",
    page.locator("label").filter({ hasText: d.portada.agregar }),
    design.locator('[aria-label="Foto de portada · toca para cambiar"]'),
    ["height", "border-radius", "color", "font-size", "font-weight"],
  );
  await compare(
    "etiqueta",
    page.locator("label", { hasText: d.campos.nombre }),
    design.locator("label[for=db1]"),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "campo",
    page.getByRole("textbox", { name: d.campos.nombre }),
    design.locator("#db1"),
    ["height", "border-radius", "background-color", "font-size", "color"],
  );
  await compare(
    "ayuda",
    page.getByText(d.ayudas.whatsapp, { exact: true }),
    design.getByText(
      "Aparece como botón en tu página. Por aquí no enviamos mensajes.",
      { exact: true },
    ),
    ["font-size", "color"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: d.guardar, exact: true }),
    design.getByRole("link", { name: "Guardar", exact: true }),
    primaryButton,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-57");
  await design.close();
});

test("D-59 matches the design", async ({ page }) => {
  test.setTimeout(120_000);
  const slug = await signInReadyOwner(page, "fidelidad-festivos");
  // The design's closure: from 2:00 p. m. to the end of a day, three days
  // from now so it has not ended.
  const day = addDays(toBogotaDate(new Date()), 3);
  await insertShopClosure(slug, {
    startsAt: fromBogota(day, "14:00"),
    endsAt: startOfBogotaDay(addDays(day, 1)),
    reason: "Nochebuena",
  });
  await page.goto("/panel/horario/festivos");
  const f = textos.festivos;
  await expect(
    page.getByRole("heading", { level: 1, name: f.titulo }),
  ).toBeVisible({ timeout: 20_000 });
  const design = await openDesign(page, "D59-Festivos-cierres.dc.html");
  const firstHoliday = page.getByRole("switch").first();

  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Festivos y cierres", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "título de sección",
    page.getByRole("heading", { level: 2, name: f.festivos }),
    design.getByRole("heading", { level: 2, name: "Festivos de Colombia" }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "bajada",
    page.getByText(f.bajada),
    design.getByText("Por defecto cerramos."),
    ["font-size", "line-height", "color"],
  );
  await compare(
    "tarjeta de festivos",
    page.locator("ul").filter({ has: firstHoliday }),
    design.getByText("Independencia de Cartagena").locator("../../../.."),
    ["border-radius", "background-color"],
  );
  // The switch is named by the day; its row draws the day and the holiday.
  await compare(
    "día del festivo",
    page.locator(
      `[id="${await firstHoliday.getAttribute("aria-labelledby")}"]`,
    ),
    design.getByText("Lunes 16 de noviembre", { exact: true }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "nombre del festivo",
    page.locator(
      `[id="${await firstHoliday.getAttribute("aria-describedby")}"]`,
    ),
    design.getByText("Independencia de Cartagena", { exact: true }),
    ["font-size", "line-height", "color"],
  );
  await compare(
    "cierre",
    page.getByText(/ · desde 2:00 p\. m\.$/),
    design.getByText("Jueves 24 de diciembre · desde 2:00 p. m.", {
      exact: true,
    }),
    ["font-size", "font-weight", "color"],
  );
  await compare(
    "detalle del cierre",
    page.getByText(`${f.todaLaBarberia} · Nochebuena`, { exact: true }),
    design.getByText("Toda la barbería · Nochebuena", { exact: true }),
    ["font-size", "line-height", "color"],
  );
  await compare(
    "agregar cierre",
    page.getByRole("button", { name: f.agregar }),
    design.getByRole("button", { name: "Agregar cierre" }),
    ["height", "border-radius", "background-color", "font-size", "font-weight"],
  );
  await compare(
    "botón principal",
    page.getByRole("button", { name: f.guardar, exact: true }),
    design.getByRole("link", { name: "Guardar", exact: true }),
    primaryButton,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);

  await attachSideBySide(page, design, "D-59");
  await design.close();
});
