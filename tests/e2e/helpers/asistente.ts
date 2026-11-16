import { expect, type Page } from "@playwright/test";
import { textos } from "../../../src/ui/textos";

const t = textos.asistente;

// The services almost every test expects of a shop that went through the
// wizard. The fourth is not offered, as the wizard once suggested.
const KNOWN_SERVICES = [
  ["Corte", 25_000, 40, true],
  ["Barba", 15_000, 20, true],
  ["Cejas", 8_000, 10, true],
  ["Niños", 20_000, 30, false],
] as const;

// The wizard starts with two placeholders to fill in (task 7.3). This puts
// the known services in the draft the wizard keeps in the browser, as an
// owner who had typed them, and reloads so the wizard takes them.
export async function fillSetupServices(page: Page) {
  const prefix = "yapoin:asistente:";
  await page.waitForFunction(
    (start) =>
      Object.keys(window.sessionStorage).some((key) => key.startsWith(start)),
    prefix,
    { timeout: 20_000 },
  );
  await page.evaluate(
    ({ start, known }) => {
      const draft = {
        services: known.map(
          ([name, priceCop, durationMinutes, offered], i) => ({
            key: `sugerido-${i + 1}`,
            name,
            priceCop,
            durationMinutes,
            offered,
          }),
        ),
        ownerCuts: true,
        barbers: [],
      };
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith(start)) {
          window.sessionStorage.setItem(key, JSON.stringify(draft));
        }
      }
    },
    { start: prefix, known: KNOWN_SERVICES },
  );
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: t.servicios.ofrecer("Corte") }),
  ).toBeChecked({ timeout: 20_000 });
}

// A new owner lands on the setup wizard. This fills in the known services
// and finishes it, so a test can go on to the panel. The dev server compiles
// each page the first time it is opened, hence the longer waits.
export async function finishSetup(page: Page) {
  await expect(page).toHaveURL(/\/panel\/configurar$/, { timeout: 20_000 });
  await fillSetupServices(page);
  await page.getByRole("link", { name: t.servicios.continuar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: t.equipo.terminar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, {
    timeout: 20_000,
  });
  await page.getByRole("link", { name: t.listo.agenda }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
  // "Ir a la agenda" loads the whole page (see configurar/listo/page.tsx):
  // its title, today, means the agenda is the page now, so the next page.goto()
  // has nothing in flight to interrupt it.
  await expect(
    page
      .getByRole("heading", {
        level: 1,
        name: new RegExp(`^${textos.agenda.hoy("")}`),
      })
      .filter({ visible: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/panel$/);
}
