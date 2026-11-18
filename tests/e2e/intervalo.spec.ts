import { expect, test, type Browser, type Page } from "@playwright/test";
import { formatCalendarDay } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { signInOwner } from "./helpers/clientes";
import {
  capitalize,
  chooseServicesAndBarber,
  FIRST_VISIT,
  tomorrow,
} from "./helpers/reserva";
import { createBookableShop } from "./helpers/supabase";

// Task 7.11: the owner chooses every how many minutes customers are offered
// times, and the public booking follows it.
const t = textos.politicas;

// Opens the booking as a customer without a session and returns the minutes
// of the times offered for tomorrow.
async function offeredMinutes(browser: Browser, slug: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`/${slug}`);
    await chooseServicesAndBarber(page, "Ana");
    const day = page
      .getByRole("button", {
        name: capitalize(formatCalendarDay(tomorrow())),
        exact: true,
      })
      .filter({ visible: true });
    await day.click();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    const hours = page
      .getByRole("button", { name: /^\d{1,2}:\d{2} [ap]\. m\.$/ })
      .filter({ visible: true });
    await expect(hours.first()).toBeVisible(FIRST_VISIT);
    const names = await hours.evaluateAll((buttons) =>
      buttons.map(
        (button) =>
          button.getAttribute("aria-label") ?? button.textContent ?? "",
      ),
    );
    return [...new Set(names.map((name) => name.split(":")[1]!.slice(0, 2)))];
  } finally {
    await context.close();
  }
}

async function saveInterval(page: Page, value: string) {
  await page.goto("/panel/reservas");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("combobox", { name: t.intervalo }).selectOption(value);
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);
}

test("an owner changes every how many minutes customers are offered times", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("intervalo");
  await signInOwner(page, shop.owner);
  await page.goto("/panel/reservas");
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  const interval = page.getByRole("combobox", { name: t.intervalo });
  await expect(interval).toHaveValue("15");
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  await interval.selectOption("30");
  await expect(interval).toHaveValue("30");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/mas$/, FIRST_VISIT);

  const halves = await offeredMinutes(browser, shop.slug);
  expect(halves.sort()).toEqual(["00", "30"]);

  await saveInterval(page, "60");
  // Saving expires the cached public profile at once: the very next customer
  // already sees the new interval, never the old grid.
  expect(await offeredMinutes(browser, shop.slug)).toEqual(["00"]);
});

// Task 8.15: the interval also takes 10 and 5 minutes.
test("an owner offers every 10 minutes, or every 5", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("intervalo-corto");
  await signInOwner(page, shop.owner);

  await saveInterval(page, "10");
  expect((await offeredMinutes(browser, shop.slug)).sort()).toEqual([
    "00",
    "10",
    "20",
    "30",
    "40",
    "50",
  ]);

  await saveInterval(page, "5");
  const fives = await offeredMinutes(browser, shop.slug);
  expect(fives.every((minute) => Number(minute) % 5 === 0)).toBe(true);
  expect(fives).toContain("05");
});
