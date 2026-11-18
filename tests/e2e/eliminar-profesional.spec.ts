import { expect, test, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
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
  authAccountExists,
  barberRowOf,
  createBookableShop,
  createProfessionalAccount,
  insertCustomer,
  signedInClient,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.6c (decision 0010, points 7 and 8), from the owner's side:
// - the list of Profesionales says the state of each one's access (it said
//   the state of the private link before);
// - the old address of "Link privado" opens the card;
// - "Eliminar a …" is refused while the professional has appointments to
//   come, and then deletes their account and data: their session stops, the
//   team, the booking page and the days to come no longer show them, and a
//   past appointment stays as "Profesional eliminado".
// Inviting and taking the access away are cuentas-profesional.spec.ts; that
// the owner who attends has no "Eliminar" is barberos.spec.ts.
const t = textos.barberos;
const e = t.eliminar;

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

// The row of a professional in D-53.
const rowOf = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

test("the owner deletes a professional once they have no appointment to come", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const shop = await createBookableShop("eliminar-profesional");
  const ana = {
    email: uniqueEmail("ana-eliminada"),
    password: "clave-de-ana-1",
  };
  await createProfessionalAccount(shop.barbers.ana, { ...ana, name: "Ana" });
  const customer = await insertCustomer(shop.id, {
    name: "Felipe Ramírez",
    phone: "+573001234567",
  });
  // One that already ended (90 minutes ago: yesterday's, in the first hours
  // of the day), and one tomorrow.
  const quarter = 15 * 60_000;
  const past = new Date(
    Math.floor((Date.now() - 90 * 60_000) / quarter) * quarter,
  );
  await seedAppointment({
    barbershopId: shop.id,
    customerId: customer,
    barberId: shop.barbers.ana,
    startsAt: past,
    serviceIds: [shop.services.corte],
  });
  const tomorrow = addDays(toBogotaDate(new Date()), 1);
  const toCome = await seedAppointment({
    barbershopId: shop.id,
    customerId: customer,
    barberId: shop.barbers.ana,
    startsAt: fromBogota(tomorrow, "10:00"),
    serviceIds: [shop.services.corte],
  });

  // Ana uses "Mi agenda" on her phone.
  const phone = await browser.newContext({ ...test.info().project.use });
  const pro = await phone.newPage();
  await signInProfessional(pro, ana);

  // D-53: the state of each one's access, never a link.
  await signInOwner(page, shop.owner);
  await page.goto("/panel/profesionales");
  await expect(rowOf(page, "Ana")).toContainText(
    t.accesoLista.active,
    FIRST_VISIT,
  );
  await expect(rowOf(page, "Beto")).toContainText(t.accesoLista.no_email);
  await expect(page.getByText(/link/i)).toHaveCount(0);
  await checkScreen(page);

  // The old address of "Link privado" opens the card.
  await page.goto(`/panel/profesionales/${shop.barbers.ana}/link`);
  await expect(page).toHaveURL(
    new RegExp(`/panel/profesionales/${shop.barbers.ana}$`),
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Ana" }),
  ).toBeVisible(FIRST_VISIT);

  // With an appointment to come, the sheet explains it and does not delete.
  await page.getByRole("button", { name: e.boton("Ana") }).click();
  const sheet = page.getByRole("dialog", { name: e.titulo("Ana") });
  await expect(sheet.getByText(e.conCitas(1))).toBeVisible();
  await expect(sheet.getByRole("button", { name: e.si })).toHaveCount(0);
  await checkScreen(page);
  await sheet.getByRole("button", { name: e.entendido }).click();

  // The owner cancels it, and comes back.
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const { error } = await owner.rpc("set_appointment_status", {
    p_appointment_id: toCome,
    p_status: "cancelled_by_barbershop",
  });
  expect(error).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: e.boton("Ana") }).click();
  await expect(sheet.getByText(e.borra)).toBeVisible(FIRST_VISIT);
  await expect(sheet.getByText(e.queda)).toBeVisible();
  await checkScreen(page);
  await sheet.getByRole("button", { name: e.si }).click();
  await expect(page).toHaveURL(/\/panel\/profesionales$/, FIRST_VISIT);
  await expect(rowOf(page, "Ana")).toHaveCount(0);
  await expect(rowOf(page, "Beto")).toBeVisible();

  // What the database kept: the row, without her data, and no account.
  const row = await barberRowOf(shop.barbers.ana);
  expect(row).toMatchObject({
    display_name: "Profesional eliminado",
    email: null,
    photo_path: null,
    active: false,
    profile_id: null,
  });
  expect(row.deleted_at).not.toBeNull();
  expect(await authAccountExists(ana.email)).toBe(false);

  // Her card is gone; the agenda of that day still names the past
  // appointment. By its own day, not "today": this failed in CI at 00:20.
  await page.goto(`/panel/profesionales/${shop.barbers.ana}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ana" }),
  ).toHaveCount(0);
  await page.goto(`/panel?dia=${toBogotaDate(past)}`);
  await expect(
    page.getByText("Profesional eliminado").filter({ visible: true }).first(),
  ).toBeVisible(FIRST_VISIT);

  // The booking page no longer offers her.
  await page.goto(`/${shop.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Barbería La Esquina" }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByText("Ana", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Profesional eliminado")).toHaveCount(0);

  // Her session is over: "Mi agenda" sends her to sign in, and her password
  // no longer works.
  await pro.goto("/mi-agenda");
  await expect(pro).toHaveURL(/\/ingresar/, FIRST_VISIT);
  const ingreso = textos.cuentas.ingreso;
  await pro
    .getByRole("textbox", { name: ingreso.campos.email })
    .fill(ana.email);
  await pro
    .getByLabel(ingreso.campos.password)
    .filter({ visible: true })
    .fill(ana.password);
  await pro.getByRole("button", { name: ingreso.enviar }).click();
  await expect(
    pro.getByText(textos.cuentas.errores.invalid_credentials),
  ).toBeVisible();
  await phone.close();
});
