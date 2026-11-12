import { expect, test, type Page } from "@playwright/test";
import { formatWallClock, fromBogota } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import {
  chooseServicesAndBarber,
  chooseTomorrowAt,
  fillAndConfirm,
  FIRST_VISIT,
  tomorrow,
} from "./helpers/reserva";
import {
  createBookableShop,
  setPolicies,
  webAppointments,
} from "./helpers/supabase";

// Task 3.4: the customer reaches the appointment from the link C-08 gives
// (until the confirmation email of phase 5), moves it (C-10), finds it again
// from the barbershop's page, and cancels it (C-11, C-12). Inside the
// policy's hours only WhatsApp is left (C-13); a used link says so (C-16).
const t = textos.reservas;
const g = t.gestionar;

async function screen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
}

test("the customer moves and cancels the appointment from its link", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("gestionar");
  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Ana");
  await chooseTomorrowAt(page, "10:00");
  await fillAndConfirm(page, "Camila Rojas", "camila@correo.com");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t.confirmada.titulo("Camila"),
    }),
  ).toBeVisible(FIRST_VISIT);

  // C-08 gives the link; it never travels in the URL.
  const manage = page.getByRole("link", { name: t.confirmada.gestionar });
  await expect(manage).toBeVisible();
  expect(page.url()).not.toContain("/c/");
  const href = await manage.getAttribute("href");
  expect(href).toMatch(/^\/c\/[A-Za-z0-9_-]{43}$/);
  await manage.click();

  // C-09
  await expect(
    page.getByRole("heading", { level: 1, name: g.titulo("Camila") }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(g.confirmada, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Corte · 30 min", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ana", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(g.plazo(2)).filter({ visible: true }),
  ).toBeVisible();
  await screen(page);

  // C-10: Ana tomorrow at 11:00 instead of 10:00.
  await page.getByRole("link", { name: g.cambiar }).click();
  await expect(
    page
      .getByText(g.reprogramar.liberada, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  const hour = page.getByRole("link", {
    name: formatWallClock("11:00"),
    exact: true,
  });
  await hour.click();
  await expect(hour).toHaveAttribute("aria-current", "true", FIRST_VISIT);
  // Its own time is not offered as a change.
  await expect(
    page.getByRole("link", { name: formatWallClock("10:00"), exact: true }),
  ).toHaveCount(0);
  await screen(page);
  const change = page.getByRole("button", { name: g.reprogramar.boton });
  await change.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText(g.cambiada).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  const [moved] = await webAppointments(shop.id);
  expect(new Date(moved!.starts_at).toISOString()).toBe(
    fromBogota(tomorrow(), "11:00").toISOString(),
  );
  expect(moved).toMatchObject({
    barber_id: shop.barbers.ana,
    status: "confirmed",
  });

  // The barbershop's page shows the appointment this phone booked.
  await page.goto(`/${shop.slug}`);
  const kept = page.getByRole("link", { name: g.aviso.ver });
  await expect(kept).toBeVisible(FIRST_VISIT);
  await expect(kept).toHaveAttribute("href", href!);

  // C-13: inside the policy's hours there is nothing to change.
  await setPolicies(shop.slug, {
    minBookingNoticeMinutes: 60,
    cancellationNoticeHours: 72,
  });
  await page.goto(href!);
  await expect(
    page.getByText(g.fueraDePlazo.titulo).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByRole("button", { name: g.cancelar })).toHaveCount(0);
  await expect(page.getByRole("link", { name: g.cambiar })).toHaveCount(0);
  await screen(page);
  await setPolicies(shop.slug, {
    minBookingNoticeMinutes: 60,
    cancellationNoticeHours: 2,
  });

  // C-11 and C-12
  await page.goto(href!);
  await page.getByRole("button", { name: g.cancelar }).click();
  const sheet = page.getByRole("dialog", { name: g.hoja.titulo });
  await expect(sheet).toBeVisible();
  await screen(page);
  await sheet.getByRole("button", { name: g.hoja.si }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: g.cancelada.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await screen(page);
  const [cancelled] = await webAppointments(shop.id);
  expect(cancelled!.status).toBe("cancelled_by_customer");

  // C-16: the link no longer works, and the page leads back to the shop.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: g.vencido.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByRole("link", { name: g.vencido.ir })).toHaveAttribute(
    "href",
    `/${shop.slug}`,
  );
  await screen(page);
});

test("a made-up link shows C-16 and says nothing about any appointment", async ({
  page,
}) => {
  await page.goto(`/c/${"x".repeat(43)}`);
  await expect(
    page.getByRole("heading", { level: 1, name: g.vencido.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: g.vencido.inicio }),
  ).toBeVisible();
  await page.goto("/c/corto");
  await expect(
    page.getByRole("heading", { level: 1, name: g.vencido.titulo }),
  ).toBeVisible(FIRST_VISIT);
});
