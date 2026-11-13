import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import { blockHref, newAppointmentHref } from "../../src/lib/routes";
import { addManualAppointment, bookOnline } from "./helpers/agenda";
import { signInOwner } from "./helpers/clientes";
import { createBookableShop, signedInClient } from "./helpers/supabase";

// Task 4.2: D-34 to D-39 against the design (docs/diseno, copied from Claude
// Design on 2026-11-12) at 390 x 844, the way fidelidad-clientes.spec.ts
// measures its screens: styles with 1 px of slack, both screenshots in the
// report. Touch targets of 44 px where the design draws less (decision M4).
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
// A pill: 9999px against the design's 12 px draw the same at 24 px.
const CHIP = ["height", "background-color", "color", "font-size"] as const;

const t = textos.agenda;
const FIRST_VISIT = { timeout: 20_000 };
const CHOICE = [
  "height",
  "border-radius",
  "background-color",
  "color",
  "font-size",
  "font-weight",
] as const;
// The title of a top bar in the design: its first span.
const designTitle = (design: Page) =>
  design.locator("x-dc > div > div").first().locator("span").first();

test("D-34 to D-39 match the design", async ({ page }) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("fidelidad-citas");
  const { ana, beto } = shop.barbers;
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const today = toBogotaDate(new Date());
  const tomorrow = addDays(today, 1);
  // One that started 20 minutes ago (it can be marked) and a web booking.
  const started = await addManualAppointment(owner, shop.id, {
    barberId: ana,
    startsAt: new Date(Date.now() - 20 * 60_000),
    serviceIds: [shop.services.corte, shop.services.barba],
    customerName: "Camila Rojas",
  });
  const web = await bookOnline(shop.id, {
    barberId: beto,
    startsAt: fromBogota(tomorrow, "10:00"),
    serviceIds: [shop.services.corte],
    name: "Mateo Ruiz",
    email: "mateo@correo.com",
  });
  await signInOwner(page, shop.owner);

  // D-34
  await page.goto(`/panel/citas/${started}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Camila Rojas" }),
  ).toBeVisible(FIRST_VISIT);
  let design = await openDesign(page, "D34-Detalle-cita.dc.html");
  await compare(
    "título de la barra",
    page
      .getByText(t.detalleCita.titulo, { exact: true })
      .filter({ visible: true }),
    designTitle(design),
    TEXT,
  );
  await compare(
    "nombre",
    page.getByRole("heading", { level: 1 }),
    design.getByRole("heading", { level: 1 }),
    [...TEXT, "line-height"],
  );
  await compare(
    "chip de estado",
    page
      .getByText(t.estados.confirmed, { exact: true })
      .filter({ visible: true }),
    design.getByText("Confirmada", { exact: true }),
    CHIP,
  );
  await compare(
    "etiqueta",
    page
      .getByText(t.detalleCita.cuando, { exact: true })
      .filter({ visible: true }),
    design.getByText("Cuándo", { exact: true }),
    TEXT,
  );
  await compare(
    "valor",
    page.getByText("$40.000", { exact: true }).filter({ visible: true }),
    design.getByText("$40.000", { exact: true }),
    TEXT,
  );
  for (const [ours, theirs] of [
    [t.detalleCita.atendida, "Atendida"],
    [t.detalleCita.noAsistio, "No asistió"],
    [t.detalleCita.cancelar, "Cancelar cita"],
  ] as const) {
    await compare(
      theirs,
      page.getByRole("button", { name: ours }),
      design.getByRole("link", { name: theirs }),
      BUTTON,
    );
  }
  await compare(
    "Reprogramar",
    page.getByRole("link", { name: t.detalleCita.reprogramar }),
    design.getByRole("link", { name: "Reprogramar" }),
    BUTTON,
  );
  await compare("fondo", page.locator("body"), design.locator("x-dc > div"), [
    "background-color",
  ]);
  await attachSideBySide(page, design, "D-34");
  await design.close();

  // D-35
  await page.getByRole("button", { name: t.detalleCita.atendida }).click();
  const mark = page.getByRole("dialog", { name: t.marcar.titulo });
  await expect(mark).toBeVisible();
  design = await openDesign(page, "D35-Cambiar-estado.dc.html");
  await compare(
    "título de la hoja",
    mark.getByRole("heading", { name: t.marcar.titulo }),
    design.getByRole("heading", { name: "Marcar cita" }),
    TEXT,
  );
  await compare(
    "Atendida",
    mark.getByRole("button", { name: t.detalleCita.atendida }),
    design.getByRole("link", { name: "Atendida" }),
    CHOICE,
  );
  await compare(
    "No asistió",
    mark.getByRole("button", { name: t.detalleCita.noAsistio }),
    design.getByRole("link", { name: "No asistió" }),
    CHOICE,
  );
  await attachSideBySide(page, design, "D-35");
  await design.close();
  await page.keyboard.press("Escape");

  // D-36
  await page.goto(`/panel/citas/${web}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mateo Ruiz" }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("button", { name: t.detalleCita.cancelar }).click();
  const cancel = page.getByRole("dialog", { name: t.cancelar.titulo });
  await expect(cancel).toBeVisible();
  design = await openDesign(page, "D36-Cancelar-cita.dc.html");
  await compare(
    "título de la hoja",
    cancel.getByRole("heading", { name: t.cancelar.titulo }),
    design.getByRole("heading", { name: "¿Cancelar esta cita?" }),
    TEXT,
  );
  await compare(
    "Cancelar cita",
    cancel.getByRole("button", { name: t.cancelar.confirmar }),
    design.getByRole("link", { name: "Cancelar cita" }),
    BUTTON,
  );
  await compare(
    "Volver",
    cancel.getByRole("button", { name: t.cancelar.volver }),
    design.getByRole("dialog").getByRole("link", { name: "Volver" }),
    BUTTON,
  );
  await attachSideBySide(page, design, "D-36");
  await design.close();
  await page.keyboard.press("Escape");

  // D-37
  await page.goto(`/panel/citas/${web}/reprogramar`);
  await expect(
    page.getByRole("heading", { level: 1, name: t.reprogramar.titulo }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D37-Reprogramar.dc.html");
  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    designTitle(design),
    TEXT,
  );
  await compare(
    "hora libre",
    page.getByRole("radio").first().locator(".."),
    design.getByRole("button", { name: "9:00", exact: true }),
    CHOICE,
  );
  await compare(
    "título de las horas",
    page.getByText(t.reprogramar.horas(30), { exact: true }),
    design.getByText("Horas libres (60 min)", { exact: true }),
    TEXT,
  );
  await compare(
    "Guardar cambio",
    page.getByRole("button", { name: t.reprogramar.guardar }),
    design.getByRole("link", { name: "Guardar cambio" }),
    ["height", "border-radius", "font-size", "font-weight"],
  );
  await attachSideBySide(page, design, "D-37");
  await design.close();

  // D-38
  await page.goto(
    newAppointmentHref({ barbero: ana, dia: tomorrow, hora: "15:00" }),
  );
  await expect(
    page.getByRole("heading", { level: 1, name: t.nueva.titulo }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D38-Nueva-cita.dc.html");
  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    designTitle(design),
    TEXT,
  );
  await compare(
    "sección",
    page
      .getByText(t.nueva.servicios, { exact: true })
      .filter({ visible: true }),
    design.getByRole("heading", { name: "Servicios" }),
    TEXT,
  );
  await compare(
    "aviso sin correo",
    page.getByText(t.nueva.sinCorreo.titulo, { exact: true }),
    design.getByText("Sin correo no hay confirmación ni recordatorio", {
      exact: true,
    }),
    TEXT,
  );
  await compare(
    "Crear cita",
    page.getByRole("button", { name: t.nueva.crearCita }),
    design.getByRole("link", { name: "Crear cita" }),
    ["height", "border-radius", "font-size", "font-weight"],
  );
  await attachSideBySide(page, design, "D-38");
  await design.close();

  // D-39
  await page.goto(blockHref({ barbero: beto, dia: tomorrow, desde: "10:00" }));
  await expect(
    page.getByRole("heading", { level: 1, name: t.bloquear.titulo }),
  ).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D39-Bloquear-horas.dc.html");
  await compare(
    "título de la barra",
    page.getByRole("heading", { level: 1 }),
    designTitle(design),
    TEXT,
  );
  // The chips measure 44 px (40 in the design, decision M4).
  await compare(
    "motivo",
    page.getByText("Permiso", { exact: true }).filter({ visible: true }),
    design.getByRole("button", { name: "Permiso" }),
    ["background-color", "color", "font-size", "font-weight"],
  );
  await compare(
    "aviso de citas",
    page.getByText(t.bloquear.conCitas("Beto", 1), { exact: true }),
    design.getByText("Kevin tiene 1 cita en ese horario", { exact: true }),
    TEXT,
  );
  await compare(
    "Bloquear",
    page.getByRole("button", { name: t.bloquear.enviar }),
    design.getByRole("link", { name: "Bloquear" }),
    ["height", "border-radius", "font-size", "font-weight"],
  );
  await attachSideBySide(page, design, "D-39");
  await design.close();
});
