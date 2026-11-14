import { expect, test } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import {
  chooseServicesAndBarber,
  chooseTomorrowAt,
  fillAndConfirm,
  FIRST_VISIT,
} from "./helpers/reserva";
import {
  appointmentEmails,
  createBookableShop,
  customerConfirmations,
  webAppointments,
} from "./helpers/supabase";

// Task 5.3: a booking queues its reminder (the customer's only email for
// it), and the buttons of the reminder ask for one tap on the appointment's
// link: "Confirmo" saves the answer, "Cancelar" opens the sheet of C-11.
const t = textos.reservas;
const g = t.gestionar;

const HOUR = 3_600_000;

// The rule of private.reminder_time: 24 h before, 3 h before when there is
// no time for that, at once when not even that.
function reminderTime(start: Date, now: Date): number {
  if (start.getTime() - 24 * HOUR > now.getTime())
    return start.getTime() - 24 * HOUR;
  if (start.getTime() - 3 * HOUR > now.getTime())
    return start.getTime() - 3 * HOUR;
  return now.getTime();
}

test("a booking queues its reminder, and the reminder's buttons ask for one tap", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("recordatorio");
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
  // C-08 says the reminder arrives by email.
  await expect(
    page.getByText(t.confirmada.bajada).filter({ visible: true }),
  ).toBeVisible();

  const [appointment] = await webAppointments(shop.id);
  const start = new Date(appointment!.starts_at);
  const reminders = (await appointmentEmails(shop.id)).filter(
    (email) => email.type === "appointment_reminder",
  );
  expect(reminders).toHaveLength(1);
  const due = new Date(reminders[0]!.scheduled_for).getTime();
  expect(Math.abs(due - reminderTime(start, new Date()))).toBeLessThan(
    5 * 60_000,
  );
  // Nothing personal in the queue: only the start it was queued for.
  expect(Object.keys(reminders[0]!.payload as object)).toEqual(["starts_at"]);

  const href = await page
    .getByRole("link", { name: t.confirmada.gestionar })
    .getAttribute("href");
  expect(href).toMatch(/^\/c\/[A-Za-z0-9_-]{43}$/);

  // "Confirmo": the link alone changes nothing; one tap does.
  await page.goto(`${href}?confirmo=1`);
  await expect(
    page.getByRole("heading", { level: 2, name: g.confirmar.pregunta }),
  ).toBeVisible(FIRST_VISIT);
  expect(
    (await customerConfirmations(shop.id))[0]!.customer_confirmed_at,
  ).toBeNull();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await page.getByRole("button", { name: g.confirmar.si }).click();
  await expect(
    page
      .getByText(g.confirmar.listo("Barbería La Esquina"))
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText(g.confirmar.yaConfirmaste, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  expect(
    (await customerConfirmations(shop.id))[0]!.customer_confirmed_at,
  ).not.toBeNull();

  // Again from the email: it already says so and asks nothing.
  await page.goto(`${href}?confirmo=1`);
  await expect(
    page
      .getByText(g.confirmar.yaConfirmaste, { exact: true })
      .filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByRole("button", { name: g.confirmar.si })).toHaveCount(
    0,
  );

  // "Cancelar": the sheet of C-11 opens, and nothing is cancelled until the tap.
  await page.goto(`${href}?cancelar=1`);
  const sheet = page.getByRole("dialog", { name: g.hoja.titulo });
  await expect(sheet).toBeVisible(FIRST_VISIT);
  await sheet.getByRole("button", { name: g.hoja.si }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: g.cancelada.titulo }),
  ).toBeVisible();
  expect((await webAppointments(shop.id))[0]!.status).toBe(
    "cancelled_by_customer",
  );
});
