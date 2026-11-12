import { expect, test, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import {
  agendaHref,
  blockHref,
  newAppointmentHref,
} from "../../src/lib/routes";
import { textos } from "../../src/ui/textos";
import { dayTitle } from "../../src/app/(panel)/panel/agenda-labels";
import { addManualAppointment } from "./helpers/agenda";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop, signedInClient } from "./helpers/supabase";

// Task 4.2: what the owner does with an appointment from the panel. D-38
// creates a manual one for a walk-in without email; D-34 changes its
// services, D-37 moves it to another barber, D-36 cancels it; D-35 marks one
// that started and corrects the mark; D-39 refuses a block over an
// appointment and makes one elsewhere, and the agenda's sheet removes it.
const t = textos.agenda;
const TO_SCALE = { except: "[data-to-scale]" };

async function signIn(page: Page, owner: { email: string; password: string }) {
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(owner.email);
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.password })
    .fill(owner.password);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
}

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { level: 1, name });

const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });

async function checkScreen(page: Page, toScale = false) {
  await expectAccessible(page);
  await expectTouchTargets(page, toScale ? TO_SCALE : undefined);
  await expectNoZoomOnFocus(page);
}

test("the owner books a walk-in, changes, moves and cancels it", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("citas");
  const { ana, beto } = shop.barbers;
  const today = toBogotaDate(new Date());
  const tomorrow = addDays(today, 1);

  await signIn(page, shop.owner);

  // D-38 from a free space of Ana tomorrow at 10:00.
  await page.goto(
    newAppointmentHref({ barbero: ana, dia: tomorrow, hora: "10:00" }),
  );
  await expect(heading(page, t.nueva.titulo)).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("textbox", { name: t.nueva.buscar })
    .fill("Pedro Caminante");
  await page
    .getByRole("button", { name: t.nueva.crear("Pedro Caminante") })
    .click();
  await expect(visibleText(page, t.nueva.sinCorreo.titulo)).toBeVisible();
  await page.getByRole("checkbox", { name: "Corte" }).check({ force: true });
  await expect(
    page.getByRole("combobox", { name: t.nueva.barbero }),
  ).toHaveValue(ana);
  await expect(
    page.getByRole("button", { name: new RegExp(t.nueva.diaHora) }),
  ).toContainText(
    t.nueva.horaElegida(dayTitle(tomorrow, today), "10:00 a. m.", "10:30"),
  );
  await checkScreen(page);
  await page.getByRole("button", { name: t.nueva.crearCita }).click();

  // D-34 of the new appointment.
  await expect(page).toHaveURL(
    /\/panel\/citas\/[0-9a-f-]+\?hecho=created$/,
    FIRST_VISIT,
  );
  await expect(heading(page, "Pedro Caminante")).toBeVisible(FIRST_VISIT);
  await expect(visibleText(page, t.detalleCita.hechos.created)).toBeVisible();
  await expect(visibleText(page, t.detalleCita.origen.manual)).toBeVisible();
  await expect(visibleText(page, "Corte (30 min)")).toBeVisible();
  await expect(visibleText(page, "$25.000")).toBeVisible();
  await checkScreen(page);

  // The pencil: add the beard.
  await page.getByRole("button", { name: t.detalleCita.editar }).click();
  const services = page.getByRole("dialog", { name: t.servicios.titulo });
  await services
    .getByRole("checkbox", { name: "Barba" })
    .check({ force: true });
  await expect(services.getByText("$40.000")).toBeVisible();
  await expectAccessible(page);
  await services.getByRole("button", { name: t.servicios.guardar }).click();
  await expect(visibleText(page, t.detalleCita.hechos.services)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    visibleText(page, "Corte (30 min) + Barba (15 min)"),
  ).toBeVisible();
  await expect(visibleText(page, "$40.000")).toBeVisible();

  // D-37: to Beto, tomorrow at 11:00.
  await page.getByRole("link", { name: t.detalleCita.reprogramar }).click();
  await expect(heading(page, t.reprogramar.titulo)).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("combobox", { name: t.reprogramar.barbero })
    .selectOption(beto);
  await page
    .getByRole("combobox", { name: t.reprogramar.dia })
    .selectOption(tomorrow);
  await page.getByRole("radio", { name: "11:00 a. m." }).check({ force: true });
  await checkScreen(page);
  await page.getByRole("button", { name: t.reprogramar.guardar }).click();
  await expect(visibleText(page, t.detalleCita.hechos.rescheduled)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, "Beto")).toBeVisible();

  // D-36: cancel it.
  await page.getByRole("button", { name: t.detalleCita.cancelar }).click();
  const cancel = page.getByRole("dialog", { name: t.cancelar.titulo });
  await expect(cancel).toBeVisible();
  await expectAccessible(page);
  await cancel.getByRole("button", { name: t.cancelar.confirmar }).click();
  await expect(visibleText(page, t.detalleCita.hechos.cancelled)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    visibleText(page, t.detalleCita.chips.canceladaBarberia),
  ).toBeVisible();
  // A cancelled appointment has nothing left to do.
  await expect(
    page.getByRole("button", { name: t.detalleCita.cancelar }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: t.detalleCita.editar }),
  ).toHaveCount(0);
});

test("the owner marks an appointment that started and corrects it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("marcar");
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const started = new Date(Date.now() - 20 * 60_000);
  const id = await addManualAppointment(owner, shop.id, {
    barberId: shop.barbers.ana,
    startsAt: started,
    serviceIds: [shop.services.corte],
    customerName: "Sara Llegó",
  });

  await signIn(page, shop.owner);
  await page.goto(`/panel/citas/${id}`);
  await expect(heading(page, "Sara Llegó")).toBeVisible(FIRST_VISIT);

  // D-35 from "No asistió".
  await page.getByRole("button", { name: t.detalleCita.noAsistio }).click();
  const mark = page.getByRole("dialog", { name: t.marcar.titulo });
  await expect(mark.getByText(t.marcar.nota)).toBeVisible();
  await expectAccessible(page);
  await mark.getByRole("button", { name: t.detalleCita.noAsistio }).click();
  await expect(visibleText(page, t.detalleCita.hechos.no_show)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, t.estados.no_show).first()).toBeVisible();

  // And corrected to attended.
  await page.getByRole("button", { name: t.detalleCita.atendida }).click();
  await page
    .getByRole("dialog", { name: t.marcar.titulo })
    .getByRole("button", { name: t.detalleCita.atendida })
    .click();
  await expect(visibleText(page, t.detalleCita.hechos.attended)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(visibleText(page, t.estados.attended).first()).toBeVisible();
  await checkScreen(page);
});

test("the owner blocks hours around appointments and removes the block", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("bloquear");
  const { beto } = shop.barbers;
  const today = toBogotaDate(new Date());
  const tomorrow = addDays(today, 1);
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  await addManualAppointment(owner, shop.id, {
    barberId: beto,
    startsAt: fromBogota(tomorrow, "12:00"),
    serviceIds: [shop.services.corte],
    customerName: "Mateo Ruiz",
  });

  await signIn(page, shop.owner);

  // D-39 over Mateo's appointment: the warning, and "Bloquear" waits.
  await page.goto(blockHref({ barbero: beto, dia: tomorrow, desde: "12:00" }));
  await expect(heading(page, t.bloquear.titulo)).toBeVisible(FIRST_VISIT);
  await expect(visibleText(page, t.bloquear.conCitas("Beto", 1))).toBeVisible();
  await expect(
    visibleText(
      page,
      t.bloquear.unaEnMedio(t.bloquear.citaCorta("Mateo R.", "12:00 p. m.")),
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: t.bloquear.enviar }),
  ).toBeDisabled();
  await checkScreen(page);

  // From 1:00 to 2:00 p. m., lunch.
  await page
    .getByRole("combobox", { name: t.bloquear.desde })
    .selectOption("13:00");
  await page
    .getByRole("combobox", { name: t.bloquear.hasta })
    .selectOption("14:00");
  await expect(visibleText(page, t.bloquear.conCitas("Beto", 1))).toHaveCount(
    0,
  );
  await page.getByRole("radio", { name: "Almuerzo" }).check({ force: true });
  await page.getByRole("button", { name: t.bloquear.enviar }).click();
  await expect(page).toHaveURL(
    new RegExp(`${agendaHref({ dia: tomorrow }).replace("?", "\\?")}$`),
    FIRST_VISIT,
  );

  // The block in the agenda opens its sheet, which removes it.
  const block = page
    .getByRole("button", { name: /^Almuerzo/ })
    .filter({ visible: true });
  await expect(block).toBeVisible(FIRST_VISIT);
  await block.click();
  const sheet = page.getByRole("dialog", { name: t.bloqueoHoja.titulo });
  await expect(
    sheet.getByText(t.bloqueoHoja.quien("Beto", "1:00", "2:00 p. m.")),
  ).toBeVisible();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: t.bloqueoHoja.quitar }).click();
  await expect(sheet).toHaveCount(0, FIRST_VISIT);
  await expect(
    page.getByRole("button", { name: /^Almuerzo/ }).filter({ visible: true }),
  ).toHaveCount(0, FIRST_VISIT);
  await checkScreen(page, true);
});
