import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  formatCalendarDay,
  formatWallClock,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  createBookableShop,
  suspendBarbershop,
  webAppointments,
} from "./helpers/supabase";

// Tasks 3.2 and 3.3: a customer without an account books from the
// barbershop's link (C-01 to C-08); the database checks the booking again
// and refuses a time someone else took (C-07). Each customer is a browser
// context of its own, without the owner's session.
const t = textos.reservas;
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
}

const tomorrow = () => addDays(toBogotaDate(new Date()), 1);

async function chooseServicesAndBarber(page: Page, barber: string) {
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

async function chooseTomorrowAt(page: Page, time: string) {
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

async function fillAndConfirm(page: Page, name: string, email: string) {
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

test("a customer books from the link and the appointment is a web one", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const shop = await createBookableShop("reservar");
  await page.goto(`/${shop.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Barbería La Esquina" }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);

  await chooseServicesAndBarber(page, "Ana");
  await expectAccessible(page);
  await expectTouchTargets(page);
  await chooseTomorrowAt(page, "10:00");
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
  await fillAndConfirm(page, "Camila Rojas", "Camila.Rojas@Correo.com");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t.confirmada.titulo("Camila"),
    }),
  ).toBeVisible(FIRST_VISIT);
  // Its summary names the services (the hidden choice screens say it too).
  await expect(
    page.getByText("Corte · 30 min", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  const [appointment] = await webAppointments(shop.id);
  expect(appointment).toMatchObject({
    barber_id: shop.barbers.ana,
    status: "confirmed",
    source: "web",
    customers: { full_name: "Camila Rojas", email: "camila.rojas@correo.com" },
  });
  expect(appointment!.manage_token_hash).toMatch(/^[0-9a-f]{64}$/);
  // The customer's details never travel in the URL.
  expect(page.url()).not.toContain("camila");

  // The next booking on this phone starts from the saved details.
  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Beto");
  await chooseTomorrowAt(page, "11:00");
  await expect(page.getByText(t.datos.guardados)).toBeVisible();
  await expect(
    page
      .getByRole("textbox", { name: t.datos.nombre })
      .filter({ visible: true }),
  ).toHaveValue("Camila Rojas");
  await page
    .getByRole("button", { name: t.datos.borrar })
    .filter({ visible: true })
    .click();
  await expect(
    page
      .getByRole("textbox", { name: t.datos.nombre })
      .filter({ visible: true }),
  ).toHaveValue("");
});

test("a time someone else took sends the customer back to choose (C-07)", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const shop = await createBookableShop("reservar-tomada");
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();

  // Both reach the details of Ana tomorrow at 9:00.
  for (const page of [first, second]) {
    await page.goto(`/${shop.slug}`);
    await chooseServicesAndBarber(page, "Ana");
    await chooseTomorrowAt(page, "09:00");
  }
  await fillAndConfirm(first, "Camila Rojas", "camila@correo.com");
  await expect(
    first.getByRole("heading", {
      level: 1,
      name: t.confirmada.titulo("Camila"),
    }),
  ).toBeVisible(FIRST_VISIT);

  await fillAndConfirm(second, "Andrés Gómez", "andres@correo.com");
  await expect(second.getByText(t.hora.tomada.titulo)).toBeVisible(FIRST_VISIT);
  await expect(second).toHaveURL(/paso=hora/);
  await expect(second).toHaveURL(/tomada=09%3A00/);
  await expect(
    second.getByRole("link", { name: formatWallClock("09:00"), exact: true }),
  ).toHaveCount(0);
  expect(await webAppointments(shop.id)).toHaveLength(1);

  // "El primero disponible" at that time gets Beto, who is free.
  await second.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(second, t.barbero.primero);
  await chooseTomorrowAt(second, "09:00");
  // The details typed before are still on this phone (C-07).
  await expect(
    second
      .getByRole("textbox", { name: t.datos.nombre })
      .filter({ visible: true }),
  ).toHaveValue("Andrés Gómez");
  await second
    .getByRole("button", { name: t.datos.confirmar })
    .filter({ visible: true })
    .click();
  await expect(second.getByText(t.confirmada.asignado("Beto"))).toBeVisible(
    FIRST_VISIT,
  );
  const appointments = await webAppointments(shop.id);
  expect(appointments.map((a) => a.barber_id)).toEqual([
    shop.barbers.ana,
    shop.barbers.beto,
  ]);
});

test("a barbershop that takes no bookings shows its WhatsApp (C-17)", async ({
  page,
}) => {
  const shop = await createBookableShop("reservar-suspendida");
  await suspendBarbershop(shop.id);
  await page.goto(`/${shop.slug}`);
  await expect(page.getByText(t.suspendida.titulo)).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: t.suspendida.whatsapp }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/57\d{10}$/);
  await expect(page.getByRole("link", { name: t.perfil.reservar })).toHaveCount(
    0,
  );
  await expectAccessible(page);
  await expectTouchTargets(page);

  // The flow is closed too: it leads back to the profile.
  await page.goto(`/${shop.slug}/reservar`);
  await expect(page).toHaveURL(new RegExp(`/${shop.slug}$`), FIRST_VISIT);
});

test("a link that is no barbershop's says so (C-18)", async ({ page }) => {
  await page.goto("/no-existe-esta-barberia-xyz");
  await expect(
    page.getByRole("heading", { level: 1, name: t.noExiste.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
});
