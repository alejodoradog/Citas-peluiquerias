import { expect, type Page } from "@playwright/test";
import {
  addDays,
  formatCalendarDay,
  formatWallClock,
  toBogotaDate,
} from "../../../src/lib/fechas/fechas";
import { textos } from "../../../src/ui/textos";

// The steps of the public booking (C-01 to C-06), shared by the booking
// and the "Gestionar mi cita" tests.
const t = textos.reservas;

// The dev server compiles each page the first time it is opened.
export const FIRST_VISIT = { timeout: 20_000 };

export function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

export const tomorrow = () => addDays(toBogotaDate(new Date()), 1);

export async function chooseServicesAndBarber(page: Page, barber: string) {
  await page.getByRole("link", { name: t.perfil.reservar }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.servicios.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("checkbox", { name: /Corte/ })
    .filter({ visible: true })
    .check({ force: true });
  await page
    .getByRole("button", { name: t.continuar })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.barbero.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("link", { name: new RegExp(`^${barber}`) })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: t.hora.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

export async function chooseTomorrowAt(page: Page, time: string) {
  // Each choice is a navigation: wait for it to land before the next one,
  // or the next tap lands on the page that is going away.
  // Exact: after closing time today has no hours left, and the button
  // "Ir al jueves 12 de noviembre" also contains the day's name.
  const day = page
    .getByRole("link", {
      name: capitalize(formatCalendarDay(tomorrow())),
      exact: true,
    })
    .filter({ visible: true });
  await day.click();
  await expect(day).toHaveAttribute("aria-current", "date", FIRST_VISIT);
  const hour = page
    .getByRole("link", { name: formatWallClock(time), exact: true })
    .filter({ visible: true });
  await hour.click();
  await expect(hour).toHaveAttribute("aria-current", "true", FIRST_VISIT);
  // "Continuar" rests in the bar at the bottom of the screen. A finger lands
  // on what is on top at that point: it must be the button, not the list of
  // hours under it. Checked where it is drawn, without scrolling.
  const next = page
    .getByRole("link", { name: t.continuar })
    .filter({ visible: true });
  await expect(next).toBeInViewport();
  expect(
    await next.evaluate((link) => {
      const box = link.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return hit !== null && link.contains(hit);
    }),
    "Continuar is on top where it is drawn",
  ).toBe(true);
  // Playwright's own click scrolls a sticky bar "into view" and then finds
  // the page moved under it; the keyboard follows the same link.
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 1, name: t.datos.titulo }),
  ).toBeVisible(FIRST_VISIT);
}

export async function fillAndConfirm(page: Page, name: string, email: string) {
  await page
    .getByRole("textbox", { name: t.datos.nombre })
    .filter({ visible: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: t.datos.correo })
    .filter({ visible: true })
    .fill(email);
  await page
    .getByRole("button", { name: t.datos.confirmar })
    .filter({ visible: true })
    .click();
}
