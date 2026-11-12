import { expect, test, type Page } from "@playwright/test";
import { addDays, fromBogota, toBogotaDate } from "../../src/lib/fechas/fechas";
import { agendaHref, newAppointmentHref } from "../../src/lib/routes";
import { weekOf } from "../../src/modulos/agenda/dominio/owner-agenda";
import { textos } from "../../src/ui/textos";
import {
  dayTitle,
  weekDayLabel,
  weekTitle,
} from "../../src/app/(panel)/panel/agenda-labels";
import { addBlock, addManualAppointment, bookOnline } from "./helpers/agenda";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import { createBookableShop, signedInClient } from "./helpers/supabase";

// Task 4.1: the owner's agenda. D-33 until the first appointment; then D-30
// (a column per barber, the cards lead to D-34 and the free spaces to D-38),
// D-31 (one barber) and D-32 (the week). Everything it shows is in the URL,
// so going back and reloading keep it.
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

// A card's name: what it shows, then what it has no room for, in order.
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const shown = (...parts: string[]) =>
  new RegExp(`^${parts.map(escape).join(".*")}`);

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { level: 1, name });

test("the owner reads the day, a barber's day and the week", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("agenda");
  const { ana, beto } = shop.barbers;
  const { corte, barba } = shop.services;
  const today = toBogotaDate(new Date());
  const tomorrow = addDays(today, 1);
  const at = (time: string) => fromBogota(tomorrow, time);

  // D-33: no appointment yet.
  await signIn(page, shop.owner);
  await expect(heading(page, new RegExp(`^${t.hoy("")}`))).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    page.getByText(t.vacia.compartir.titulo).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: t.vacia.compartir.boton }),
  ).toHaveAttribute("href", "/panel/compartir");
  await expect(
    page.getByRole("link", { name: t.vacia.manual.boton }),
  ).toHaveAttribute("href", "/panel/citas/nueva");
  await expectAccessible(page);
  await expectTouchTargets(page);

  // Tomorrow: a booking from the page (new), a manual appointment, one
  // attended, one no-show, a cancelled one (not drawn) and Beto's lunch.
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const camila = await bookOnline(shop.id, {
    barberId: ana,
    startsAt: at("10:00"),
    serviceIds: [corte],
    name: "Camila Rojas",
    email: "camila@correo.com",
  });
  await addManualAppointment(owner, shop.id, {
    barberId: beto,
    startsAt: at("11:00"),
    serviceIds: [corte, barba],
    customerName: "Juan",
  });
  await addManualAppointment(owner, shop.id, {
    barberId: ana,
    startsAt: at("12:00"),
    serviceIds: [corte],
    customerName: "Luis García",
    status: "attended",
  });
  await addManualAppointment(owner, shop.id, {
    barberId: beto,
    startsAt: at("09:00"),
    serviceIds: [corte],
    customerName: "Diego Pérez",
    status: "no_show",
  });
  await addManualAppointment(owner, shop.id, {
    barberId: ana,
    startsAt: at("15:00"),
    serviceIds: [corte],
    customerName: "Pedro Suárez",
    status: "cancelled_by_barbershop",
  });
  await addBlock(owner, shop.id, {
    barberId: beto,
    startsAt: at("13:00"),
    endsAt: at("14:00"),
    reason: "Almuerzo",
  });

  // D-30
  await page.goto(agendaHref({ dia: tomorrow }));
  await expect(heading(page, dayTitle(tomorrow, today))).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    page
      .getByText(t.resumen(t.citas(4), t.ayudaEspacio))
      .filter({ visible: true }),
  ).toBeVisible();
  const card = (name: string, services: string, time: string, state: string) =>
    page.getByRole("link", { name: shown(name, services, time, state) });
  await expect(
    card("Camila R.", "Corte", "10:00 a. m.", "Nueva"),
  ).toHaveAttribute("href", `/panel/citas/${camila}`);
  await expect(
    card("Juan", "Corte + Barba", "11:00 a. m.", "Manual"),
  ).toBeVisible();
  await expect(
    card("Luis G.", "Corte", "12:00 p. m.", "Atendida"),
  ).toBeVisible();
  await expect(
    card("Diego P.", "Corte", "9:00 a. m.", "No asistió"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^Pedro/ })).toHaveCount(0);
  await expect(
    page.getByText("Almuerzo", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const free = page.getByRole("link", {
    name: t.libreDesde("2:00 p. m.", "Beto"),
  });
  await expect(free).toHaveAttribute(
    "href",
    newAppointmentHref({ barbero: beto, dia: tomorrow, hora: "14:00" }),
  );
  await expectAccessible(page);
  await expectTouchTargets(page, TO_SCALE);
  await expectNoZoomOnFocus(page);

  // A card leads to D-34 and a free space to D-38 (task 4.2), and back.
  await card("Camila R.", "Corte", "10:00 a. m.", "Nueva").click();
  await expect(page).toHaveURL(
    new RegExp(`/panel/citas/${camila}$`),
    FIRST_VISIT,
  );
  await expect(heading(page, t.detalle)).toBeVisible(FIRST_VISIT);
  await page.goBack();
  await expect(heading(page, dayTitle(tomorrow, today))).toBeVisible(
    FIRST_VISIT,
  );
  await free.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/panel/citas/nueva\\?barbero=${beto}&dia=${tomorrow}&hora=14:00$`,
    ),
    FIRST_VISIT,
  );
  await expect(heading(page, textos.ui.nuevaCita)).toBeVisible(FIRST_VISIT);
  await page.goBack();

  // Day by day, and back to today.
  await page.getByRole("link", { name: t.siguiente.dia }).click();
  await expect(page).toHaveURL(
    new RegExp(`\\?dia=${addDays(tomorrow, 1)}$`),
    FIRST_VISIT,
  );
  await expect(
    heading(page, dayTitle(addDays(tomorrow, 1), today)),
  ).toBeVisible();
  await page.getByRole("link", { name: t.anterior.dia }).click();
  await expect(heading(page, dayTitle(tomorrow, today))).toBeVisible();
  await page.getByRole("link", { name: t.irAHoy, exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(heading(page, dayTitle(today, today))).toBeVisible();
  await page.goBack();
  await expect(heading(page, dayTitle(tomorrow, today))).toBeVisible();

  // D-31: Ana's day.
  await page
    .getByRole("region", { name: t.columnas })
    .getByRole("link", { name: "Ana", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`\\?dia=${tomorrow}&barbero=${ana}$`),
    FIRST_VISIT,
  );
  await expect(heading(page, t.barberos.agendaDe("Ana"))).toBeVisible();
  for (const state of [t.estados.new, t.estados.attended]) {
    await expect(
      page.getByText(state, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: new RegExp(t.libre("10:00")) }),
  ).toHaveAttribute(
    "href",
    newAppointmentHref({ barbero: ana, dia: tomorrow, hora: "06:00" }),
  );
  await expectAccessible(page);
  await expectTouchTargets(page);
  await page.reload();
  await expect(heading(page, t.barberos.agendaDe("Ana"))).toBeVisible(
    FIRST_VISIT,
  );
  await page
    .getByRole("navigation", { name: t.barberos.etiqueta })
    .getByRole("link", { name: t.barberos.todos })
    .click();
  await expect(heading(page, dayTitle(tomorrow, today))).toBeVisible();

  // D-32: the week, everyone and then only Beto.
  await page.getByRole("link", { name: t.vistas.semana, exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`\\?vista=semana&dia=${tomorrow}$`),
    FIRST_VISIT,
  );
  await expect(heading(page, weekTitle(weekOf(tomorrow)))).toBeVisible();
  const tomorrowRow = page.getByRole("link", {
    name: new RegExp(`^${weekDayLabel(tomorrow, today)} `),
  });
  await expect(tomorrowRow).toContainText(t.citas(4));
  await expect(tomorrowRow).toContainText("Ana 2 · Beto 2");
  await expectAccessible(page);
  await expectTouchTargets(page);

  await page.locator("summary").filter({ visible: true }).click();
  await page.getByRole("link", { name: "Beto", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`\\?vista=semana&dia=${tomorrow}&barbero=${beto}$`),
    FIRST_VISIT,
  );
  const betoRow = page.getByRole("link", {
    name: new RegExp(`^${weekDayLabel(tomorrow, today)} `),
  });
  await expect(betoRow).toContainText(t.citas(2));
  await expect(betoRow).not.toContainText("Ana");
  await betoRow.click();
  await expect(heading(page, t.barberos.agendaDe("Beto"))).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    page.getByText(`Almuerzo · ${t.minutos(60)}`).filter({ visible: true }),
  ).toBeVisible();
});
