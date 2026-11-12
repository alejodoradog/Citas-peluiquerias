import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { addManualAppointment, bookOnline } from "./helpers/agenda";
import {
  createBookableShop,
  issueBarberLink,
  setBarberLinkActive,
  signedInClient,
  suspendBarbershop,
} from "./helpers/supabase";

// Task 4.4: "Mi agenda" of a barber (B-01 to B-06) against the design
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

const t = textos.barbero;
const a = textos.agenda;
const TEXT = ["font-size", "font-weight", "color"] as const;

test("B-01 to B-06 match the design", async ({ page }) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("fidelidad-barbero");
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const token = await issueBarberLink(shop.barbers.ana);
  const quarter = 15 * 60_000;
  const started = new Date(
    Math.floor((Date.now() - 30 * 60_000) / quarter) * quarter,
  );
  const day = toBogotaDate(started);
  await addManualAppointment(owner, shop.id, {
    barberId: shop.barbers.ana,
    startsAt: started,
    serviceIds: [shop.services.corte],
    customerName: "Felipe Ramírez",
  });
  const tomorrow = addDays(toBogotaDate(new Date()), 1);
  await bookOnline(shop.id, {
    barberId: shop.barbers.ana,
    startsAt: fromBogota(tomorrow, "10:00"),
    serviceIds: [shop.services.corte, shop.services.barba],
    name: "Camila Rojas",
    email: "camila-fidelidad@example.com",
  });

  // B-01
  await page.goto(`/b/${token}?dia=${day}`);
  let design = await openDesign(page, "B01-Mi-agenda.dc.html");
  await compare(
    "saludo",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Hola, Kevin"),
    TEXT,
  );
  await compare(
    "sede",
    page.getByText(t.encabezado("Barbería La Esquina")),
    design.getByText("Barbería La Esquina · Mi agenda"),
    ["font-size", "color"],
  );
  await compare(
    "pestaña elegida",
    page.getByRole("link", { name: t.vistas.semana }),
    design.getByRole("link", { name: "Semana" }),
    ["border-radius", "color", "font-size", "font-weight"],
  );
  await compare(
    "hora",
    page.getByText(/^\d{1,2}:\d{2} [ap]\. m\.$/).first(),
    design.getByText("9:20 a. m."),
    TEXT,
  );
  await compare(
    "cliente",
    page.getByText("Felipe R."),
    design.getByText("Felipe R."),
    TEXT,
  );
  await compare(
    "servicios",
    page.getByText(`Corte · ${a.minutos(30)}`),
    design.getByText("Corte · 40 min").first(),
    TEXT,
  );
  await compare(
    "estado",
    page.getByText(a.estados.manual, { exact: true }),
    design.getByText("Confirmada").first(),
    ["height", "font-size", "font-weight"],
  );
  await compare(
    "atendida",
    page.getByRole("button", { name: t.marcar.atendidaDe("Felipe R.") }),
    design.getByRole("link", { name: "Atendida", exact: true }).first(),
    ["border-radius", "background-color", "color", "font-size", "font-weight"],
  );
  await compare(
    "no asistió",
    page.getByRole("button", { name: t.marcar.noAsistioDe("Felipe R.") }),
    design.getByRole("link", { name: "No asistió", exact: true }).first(),
    ["border-radius", "background-color", "color", "font-size", "font-weight"],
  );
  await compare(
    "bloquear horas",
    page.getByRole("link", { name: t.bloquearHoras }),
    design.getByRole("link", { name: "Bloquear horas" }),
    ["height", "background-color", "color", "font-weight"],
  );
  await compare(
    "solo tuyo",
    page.getByText(t.soloTuyo),
    design.getByText("Este link es solo tuyo. No lo compartas."),
    ["font-size", "color"],
  );
  await attachSideBySide(page, design, "B-01");
  await design.close();

  // B-02
  await page.getByRole("link", { name: t.vistas.semana }).click();
  await expect(page).toHaveURL(/vista=semana/, { timeout: 20_000 });
  design = await openDesign(page, "B02-Semana.dc.html");
  await compare(
    "semana",
    page.getByRole("heading", { level: 2 }),
    design.getByText("9 – 15 de noviembre"),
    TEXT,
  );
  await compare(
    "citas del día",
    page.getByText(/^\d+ citas?$/).first(),
    design.getByText("6 citas"),
    TEXT,
  );
  await attachSideBySide(page, design, "B-02");
  await design.close();

  // B-03
  await page.goto(`/b/${token}?dia=${tomorrow}`);
  await page.getByRole("link", { name: /Camila R\./ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Camila R." }),
  ).toBeVisible({ timeout: 20_000 });
  design = await openDesign(page, "B03-Detalle.dc.html");
  await compare(
    "cliente",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Camila R."),
    TEXT,
  );
  await compare(
    "dato",
    page.getByText(t.cita.cuando),
    design.getByText("Cuándo"),
    ["font-size", "color"],
  );
  await attachSideBySide(page, design, "B-03");
  await design.close();

  // B-04
  await page.goto(`/b/${token}/bloquear`);
  design = await openDesign(page, "B04-Bloquear.dc.html");
  await compare(
    "título",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Bloquear horas").first(),
    ["font-size", "font-weight"],
  );
  await compare(
    "día",
    page.getByRole("combobox", { name: t.bloquear.dia }),
    design.locator("#bb1"),
    ["height", "border-radius", "background-color"],
  );
  await compare(
    "motivo",
    page.locator("label", { hasText: t.bloquear.motivos.lunch }),
    design.getByText("Almuerzo"),
    // 44 px tall against 40, for the touch targets of F-01.
    ["font-size", "font-weight"],
  );
  await compare(
    "bloquear",
    page.getByRole("button", { name: t.bloquear.enviar }),
    design.getByRole("link", { name: "Bloquear", exact: true }),
    ["height", "background-color", "color", "font-weight"],
  );
  await attachSideBySide(page, design, "B-04");
  await design.close();

  // B-06
  await suspendBarbershop(shop.id);
  await page.goto(`/b/${token}`);
  design = await openDesign(page, "B06-Suspendida.dc.html");
  await compare(
    "pausada",
    page.getByText(t.pausada.titulo),
    design.getByText("La barbería está pausada"),
    TEXT,
  );
  await attachSideBySide(page, design, "B-06");
  await design.close();

  // B-05
  await setBarberLinkActive(shop.barbers.ana, false);
  await page.goto(`/b/${token}`);
  design = await openDesign(page, "B05-Link-desactivado.dc.html");
  await compare(
    "título",
    page.getByRole("heading", { level: 1 }),
    design.getByText("Este link ya no funciona"),
    TEXT,
  );
  await attachSideBySide(page, design, "B-05");
  await design.close();
});
