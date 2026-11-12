import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  fromBogota,
  toBogotaDate,
  getWeekday,
} from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { addManualAppointment, bookOnline } from "./helpers/agenda";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  createBookableShop,
  issueBarberLink,
  setBarberLinkActive,
  signedInClient,
  suspendBarbershop,
} from "./helpers/supabase";

// Task 4.4: "Mi agenda" of a barber, by their private link /b/<token>.
// B-01 (the day), B-02 (the week), B-03 (an appointment), B-04 ("Bloquear
// horas"), B-05 (a link that no longer works) and B-06 (a paused
// barbershop, read only but for the marks).
const t = textos.barbero;

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { level: 1, name });

// The start of the quarter hour `minutes` ago: an appointment that already
// started, so it can be marked (decision B2).
function startedAgo(minutes: number): Date {
  const quarter = 15 * 60_000;
  return new Date(
    Math.floor((Date.now() - minutes * 60_000) / quarter) * quarter,
  );
}

async function setUp(tag: string) {
  const shop = await createBookableShop(tag);
  const owner = await signedInClient(shop.owner.email, shop.owner.password);
  const token = await issueBarberLink(shop.barbers.ana);
  return { shop, owner, token };
}

test("a barber reads their day and week, marks appointments and blocks hours", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const { shop, owner, token } = await setUp("barbero");
  const { ana, beto } = shop.barbers;
  const { corte, barba } = shop.services;
  const tomorrow = addDays(toBogotaDate(new Date()), 1);

  const started = startedAgo(30);
  const startedDay = toBogotaDate(started);
  await addManualAppointment(owner, shop.id, {
    barberId: ana,
    startsAt: started,
    serviceIds: [corte],
    customerName: "Felipe Ramírez",
  });
  await bookOnline(shop.id, {
    barberId: ana,
    startsAt: fromBogota(tomorrow, "10:00"),
    serviceIds: [corte, barba],
    name: "Camila Rojas",
    email: "camila-barbero@example.com",
  });
  // Beto's appointment never reaches Ana's link.
  await addManualAppointment(owner, shop.id, {
    barberId: beto,
    startsAt: fromBogota(tomorrow, "11:00"),
    serviceIds: [corte],
    customerName: "Otro Cliente",
  });

  // B-01, on the day of the appointment that started.
  await page.goto(`/b/${token}?dia=${startedDay}`);
  await expect(heading(page, t.hola("Ana"))).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByText(t.encabezado("Barbería La Esquina")),
  ).toBeVisible();
  await expect(page.getByText("Felipe R.")).toBeVisible();
  await expect(page.getByText(t.soloTuyo)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  // Nothing about money or other barbers anywhere.
  await expect(page.getByText(/\$/)).toHaveCount(0);
  await expect(page.getByText("Beto")).toHaveCount(0);

  await page
    .getByRole("button", { name: t.marcar.atendidaDe("Felipe R.") })
    .click();
  await expect(
    page.getByRole("button", { name: t.marcar.atendidaDe("Felipe R.") }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("link", { name: /Felipe R\./ })
      .getByText(textos.agenda.estados.attended),
  ).toBeVisible();

  // B-02: the week, then tomorrow.
  await page.getByRole("link", { name: t.vistas.semana }).click();
  await expect(page).toHaveURL(/vista=semana/);
  await expectAccessible(page);
  await expectTouchTargets(page);
  const a = textos.agenda;
  const tomorrowLabel = a.diaSemana(
    a.diasCortos[getWeekday(tomorrow)]!,
    Number(tomorrow.slice(8)),
  );
  // Tomorrow can be in next week: the arrow gets there.
  if (getWeekday(tomorrow) === 1) {
    await page.getByRole("link", { name: a.siguiente.semana }).click();
  }
  await page
    .getByRole("link", { name: new RegExp(`^${tomorrowLabel}\\b`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`dia=${tomorrow}`));
  await expect(page.getByText("Camila R.")).toBeVisible();
  await expect(page.getByText("Otro C.")).toHaveCount(0);
  // Not started yet: nothing to mark (decision B2).
  await expect(
    page.getByRole("button", { name: t.marcar.atendidaDe("Camila R.") }),
  ).toHaveCount(0);

  // B-03.
  await page.getByRole("link", { name: /Camila R\./ }).click();
  await expect(heading(page, "Camila R.")).toBeVisible(FIRST_VISIT);
  await expect(page.getByText(t.cita.servicio("Corte", 30))).toBeVisible();
  await expect(page.getByText(t.cita.visitasLinea(0, 0))).toBeVisible();
  await expect(page.getByText(/\$|camila-barbero@/)).toHaveCount(0);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await page.getByRole("link", { name: t.cita.volver }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${token}\\?dia=${tomorrow}`));

  // B-04: a block over the appointment is refused, then a free one is saved.
  await page
    .getByRole("link", { name: t.bloquearHoras })
    .filter({ visible: true })
    .click();
  await expect(heading(page, t.bloquear.titulo)).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
  const day = page.getByRole("combobox", { name: t.bloquear.dia });
  await day.selectOption(tomorrow);
  await page
    .getByRole("combobox", { name: t.bloquear.desde })
    .selectOption("10:00");
  await page
    .getByRole("combobox", { name: t.bloquear.hasta })
    .selectOption("11:00");
  await page
    .getByRole("radio", { name: t.bloquear.motivos.lunch })
    .check({ force: true });
  await page.getByRole("button", { name: t.bloquear.enviar }).click();
  await expect(page.getByText(t.errores.overlaps_appointment)).toBeVisible();

  await page
    .getByRole("combobox", { name: t.bloquear.desde })
    .selectOption("15:00");
  await page
    .getByRole("combobox", { name: t.bloquear.hasta })
    .selectOption("16:00");
  await page.getByRole("button", { name: t.bloquear.enviar }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${token}\\?dia=${tomorrow}$`));
  const lunch = `${t.bloquear.motivos.lunch} · ${textos.agenda.minutos(60)}`;
  await expect(page.getByText(lunch)).toBeVisible();

  // "Quitar".
  await page.getByRole("button", { name: t.quitarDe(lunch) }).click();
  await expect(page.getByText(lunch)).toHaveCount(0);
});

test("a link that was deactivated or made up shows B-05", async ({ page }) => {
  test.setTimeout(120_000);
  const { shop, token } = await setUp("barbero-b05");

  await page.goto(`/b/${token}`);
  await expect(heading(page, t.hola("Ana"))).toBeVisible(FIRST_VISIT);

  await setBarberLinkActive(shop.barbers.ana, false);
  await page.reload();
  await expect(heading(page, t.vencido.titulo)).toBeVisible();
  await expect(page.getByText(t.vencido.detalle)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  await page.goto(`/b/${"x".repeat(43)}`);
  await expect(heading(page, t.vencido.titulo)).toBeVisible();
  await page.goto(`/b/${token}/citas/00000000-0000-4000-8000-000000000000`);
  await expect(heading(page, t.vencido.titulo)).toBeVisible(FIRST_VISIT);
});

test("a paused barbershop leaves the agenda read only, but for the marks (B-06)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { shop, owner, token } = await setUp("barbero-b06");
  const started = startedAgo(30);
  await addManualAppointment(owner, shop.id, {
    barberId: shop.barbers.ana,
    startsAt: started,
    serviceIds: [shop.services.corte],
    customerName: "Mateo Gil",
  });
  await suspendBarbershop(shop.id);

  await page.goto(`/b/${token}?dia=${toBogotaDate(started)}`);
  await expect(page.getByText(t.pausada.titulo)).toBeVisible(FIRST_VISIT);
  await expect(page.getByRole("link", { name: t.bloquearHoras })).toHaveCount(
    0,
  );
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // Decision B6: marking still works (spec, Suscripciones, point 6).
  await page
    .getByRole("button", { name: t.marcar.noAsistioDe("Mateo G.") })
    .click();
  await expect(
    page
      .getByRole("link", { name: /Mateo G\./ })
      .getByText(textos.agenda.estados.no_show),
  ).toBeVisible();

  await page.goto(`/b/${token}/bloquear`);
  await expect(page.getByText(t.pausada.titulo)).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("button", { name: t.bloquear.enviar }),
  ).toHaveCount(0);
});
