import { expect, test, type Page } from "@playwright/test";
import { formatWallClock, toBogotaTime } from "../../src/lib/fechas/fechas";
import { walkInStart } from "../../src/modulos/agenda/dominio/walk-in";
import { textos } from "../../src/ui/textos";
import { seedAppointment } from "./helpers/agenda";
import { signInOwner, signInProfessional } from "./helpers/clientes";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  appointmentEmails,
  createBookableShop,
  createProfessionalAccount,
  insertCustomer,
  openAllDay,
  uniqueEmail,
  walkInAppointments,
} from "./helpers/supabase";

// Task 7.7: "Cita al momento", for a customer who arrives without a booking
// (decision D5). The professional makes one from "Mi agenda" and marks it
// attended; a clash is refused and explained; the owner makes one from the
// agenda. The establishment opens all day, so the test runs at any hour.

const t = textos.citaAlMomento;

async function setUp(tag: string) {
  const shop = await createBookableShop(tag);
  await openAllDay(shop.id);
  const ana = { email: uniqueEmail(`${tag}-ana`), password: "clave-de-ana-1" };
  await createProfessionalAccount(shop.barbers.ana, { ...ana, name: "Ana" });
  return { shop, ana };
}

function walkInButton(page: Page) {
  return page.getByRole("link", { name: t.boton }).filter({ visible: true });
}

async function chooseService(page: Page, name: string) {
  await page
    .getByRole("checkbox", { name: new RegExp(`^${name}`) })
    .check({ force: true });
}

test("a professional creates a walk-in now and marks it attended", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { shop, ana } = await setUp("al-momento");

  await signInProfessional(page, ana);
  await walkInButton(page).click();
  await expect(page).toHaveURL(/\/mi-agenda\/al-momento$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { name: t.titulo }).filter({ visible: true }),
  ).toBeVisible();

  // Nothing chosen: no total, and "Crear cita" waits.
  const create = page
    .getByRole("button", { name: t.enviar })
    .filter({ visible: true });
  await expect(create).toBeDisabled();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  await chooseService(page, "Corte");
  await chooseService(page, "Barba");
  await expect(page.getByText(t.total(2, 45))).toBeVisible();
  await expect(page.getByText("$40.000")).toBeVisible();
  await page.getByRole("textbox", { name: t.nombre }).fill("Pedro Walker");
  await create.click();

  // Back in the agenda, with the appointment already there.
  await expect(page).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);
  const attended = page
    .getByRole("button", {
      name: textos.barbero.marcar.atendidaDe("Pedro W."),
    })
    .filter({ visible: true });
  await expect(attended).toBeVisible();

  const [created] = await walkInAppointments(shop.id);
  expect(created).toMatchObject({
    barber_id: shop.barbers.ana,
    status: "confirmed",
    price_cop: 40_000,
    customers: { full_name: "Pedro Walker", walk_in: false },
  });
  const start = new Date(created!.starts_at);
  expect(start.getTime() % (5 * 60_000)).toBe(0);
  expect(start.getTime()).toBeLessThanOrEqual(Date.now());
  expect(new Date(created!.ends_at).getTime() - start.getTime()).toBe(
    45 * 60_000,
  );
  // No email: neither the customer's nor the professional's notice.
  expect(
    (await appointmentEmails(shop.id)).filter(
      (email) => email.appointment_id === created!.id,
    ),
  ).toEqual([]);

  // It already started, so it is marked at once.
  await attended.click();
  await expect
    .poll(async () => (await walkInAppointments(shop.id))[0]?.status)
    .toBe("attended");
});

test("a walk-in that clashes is refused and says with what and how much is free", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { shop, ana } = await setUp("al-momento-choque");
  // An appointment of Ana 10 minutes after the start a walk-in has now.
  const appointmentAt = new Date(
    walkInStart(new Date()).getTime() + 10 * 60_000,
  );
  const customer = await insertCustomer(shop.id, {
    name: "Camila Rojas",
    phone: "+573001234567",
  });
  await seedAppointment({
    barbershopId: shop.id,
    customerId: customer,
    barberId: shop.barbers.ana,
    startsAt: appointmentAt,
    serviceIds: [shop.services.corte],
  });

  await signInProfessional(page, ana);
  await walkInButton(page).click();
  await expect(page).toHaveURL(/\/mi-agenda\/al-momento$/, FIRST_VISIT);
  await chooseService(page, "Corte");
  await page
    .getByRole("button", { name: t.enviar })
    .filter({ visible: true })
    .click();

  const alert = page.getByRole("alert").filter({ hasText: t.choque.titulo });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(
    t.choque.appointment(null, formatWallClock(toBogotaTime(appointmentAt))),
  );
  // 10 minutes, or fewer if the clock passed a multiple of 5 meanwhile.
  await expect(alert).toContainText(/este servicio dura 30\./);
  await expect(page).toHaveURL(/\/mi-agenda\/al-momento$/);
  // The choice stays, to try another service.
  await expect(page.getByRole("checkbox", { name: /^Corte/ })).toBeChecked();
  await expectAccessible(page);
  expect(await walkInAppointments(shop.id)).toEqual([]);
});

test("the owner creates a walk-in from the agenda for a professional", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("al-momento-dueno");
  await openAllDay(shop.id);

  await signInOwner(page, shop.owner);
  await walkInButton(page).click();
  await expect(page).toHaveURL(/\/panel\/citas\/al-momento/, FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  await page
    .getByRole("combobox", { name: t.profesional })
    .selectOption({ label: "Beto" });
  await chooseService(page, "Barba");
  await expect(page.getByText(t.total(1, 15))).toBeVisible();
  // No name: "Cliente al momento".
  await page
    .getByRole("button", { name: t.enviar })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);

  const [created] = await walkInAppointments(shop.id);
  expect(created).toMatchObject({
    barber_id: shop.barbers.beto,
    status: "confirmed",
    price_cop: 15_000,
    customers: { full_name: "Cliente al momento", walk_in: true },
  });
  expect(
    (await appointmentEmails(shop.id)).filter(
      (email) => email.appointment_id === created!.id,
    ),
  ).toEqual([]);

  // The customer without a name stays out of the list of customers.
  await page.goto("/panel/clientes");
  await expect(
    page.getByText(textos.clientes.total(0)).filter({ visible: true }),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText("Cliente al momento").filter({ visible: true }),
  ).toHaveCount(0);
});
