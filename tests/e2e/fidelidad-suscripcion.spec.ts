import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addDays,
  formatBogotaDayMonth,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { signInOwner } from "./helpers/clientes";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop, setExpiresOn } from "./helpers/supabase";

// Task 5.5: the subscription notice of the agenda against D-70, D-71 and
// D-72 at 390 × 844, as tests/e2e/fidelidad.spec.ts does for the rest of the
// app: measured styles with 1 px of slack, and both screenshots in the
// report. Its own file, as docs/trabajo-en-paralelo.md asks.
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

const t = textos.suscripcion;
const day = (date: string) => formatBogotaDayMonth(startOfBogotaDay(date));
const BOX = ["border-radius", "background-color"] as const;
const TITLE = ["font-size", "font-weight", "color"] as const;

// The notice of the app and of the design, by its title.
async function compareNotice(
  id: string,
  page: Page,
  design: Page,
  title: { app: string; design: string },
) {
  const appTitle = page
    .locator("strong")
    .filter({ hasText: title.app, visible: true });
  const designTitle = design
    .locator("strong")
    .filter({ hasText: title.design });
  await compare(
    `${id} aviso`,
    page.locator("[role=status], [role=alert]").filter({ has: appTitle }),
    design.locator("[role=status]").filter({ has: designTitle }),
    BOX,
  );
  await compare(`${id} título`, appTitle, designTitle, TITLE);
  await compare(
    `${id} detalle`,
    appTitle.locator("xpath=following-sibling::span"),
    designTitle.locator("xpath=following-sibling::span"),
    ["font-size", "color"],
  );
  await attachSideBySide(page, design, id);
}

test("D-70, D-71 and D-72 match the design", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const shop = await createBookableShop("fidelidad-suscripcion");
  const today = toBogotaDate(new Date());

  const soon = addDays(today, 2);
  await setExpiresOn(shop.id, soon);
  await signInOwner(page, shop.owner);
  await expect(page.getByText(t.vencePrueba(day(soon)))).toBeVisible(
    FIRST_VISIT,
  );
  let design = await openDesign(page, "D70-Agenda-por-vencer.dc.html");
  await compareNotice("D-70", page, design, {
    app: t.vencePrueba(day(soon)),
    design: "Tu prueba gratis vence el",
  });
  await design.close();

  const ended = addDays(today, -2);
  await setExpiresOn(shop.id, ended);
  await page.reload();
  await expect(page.getByText(t.vencida(day(ended)))).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D71-Agenda-gracia.dc.html");
  await compareNotice("D-71", page, design, {
    app: t.vencida(day(ended)),
    design: "Tu barbería venció el",
  });
  await design.close();

  await setExpiresOn(shop.id, addDays(today, -6));
  await page.reload();
  await expect(page.getByText(t.pausada)).toBeVisible(FIRST_VISIT);
  design = await openDesign(page, "D72-Agenda-suspendida.dc.html");
  await compareNotice("D-72", page, design, {
    app: t.pausada,
    design: "Tu barbería está pausada",
  });
  await design.close();
});
