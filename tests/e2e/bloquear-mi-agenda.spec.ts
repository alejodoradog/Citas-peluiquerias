import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  formatCalendarDay,
  fromBogota,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { agendaHref, blockHref } from "../../src/lib/routes";
import { textos } from "../../src/ui/textos";
import { dayTitle } from "../../src/app/(panel)/panel/agenda-labels";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  capitalize,
  chooseServicesAndBarber,
  chooseTomorrowAt,
  FIRST_VISIT,
} from "./helpers/reserva";
import {
  addAttendingOwner,
  addClosure,
  createBookableShop,
  shopBlocks,
} from "./helpers/supabase";

// Task 8.14: the owner who also attends blocks only their own agenda ("Mi
// agenda", the whole day) and the public page keeps offering the rest of the
// team; the whole establishment is a separate, clearly worded choice; a day
// the establishment already closed is offered but cannot be chosen.
const t = textos.agenda.bloquear;

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

const iso = (value: string) => new Date(value).toISOString();

test("the owner blocks their own agenda and the establishment, never what is closed", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const shop = await createBookableShop("mi-agenda");
  const today = toBogotaDate(new Date());
  const tomorrow = addDays(today, 1);
  const closedDay = addDays(today, 3);
  const carlos = await addAttendingOwner(shop.id, "Carlos", [
    shop.services.corte,
    shop.services.barba,
  ]);
  // The establishment closed the whole day three days from now.
  await addClosure(
    shop.id,
    startOfBogotaDay(closedDay),
    startOfBogotaDay(addDays(closedDay, 1)),
  );

  await signIn(page, shop.owner);
  await page.goto(blockHref());
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);

  // Three choices, "Mi agenda" first and chosen, each saying what happens.
  const mine = page.getByRole("radio", { name: t.opciones.mine.titulo });
  await expect(mine).toBeChecked();
  await expect(
    page.getByRole("radio", { name: t.opciones.barber.titulo }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("radio", { name: t.opciones.shop.titulo }),
  ).not.toBeChecked();
  await expect(
    page.getByText(t.opciones.mine.ayuda).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(t.opciones.shop.ayuda).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: t.enviarMia })).toBeVisible();

  // The closed day is there, off, with "· cerrado".
  const day = page.getByRole("combobox", { name: t.dia });
  const closedOption = day.locator(`option[value="${closedDay}"]`);
  await expect(closedOption).toBeDisabled();
  await expect(closedOption).toHaveText(
    textos.barbero.bloquear.diaCerrado(dayTitle(closedDay, today)),
  );
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);

  // Tomorrow, the whole day, for an errand: the hours leave the form.
  await day.selectOption(tomorrow);
  await page
    .getByRole("checkbox", { name: t.todoElDia })
    .check({ force: true });
  await expect(page.getByRole("combobox", { name: t.desde })).toBeHidden();
  await page.getByRole("radio", { name: "Diligencia" }).check({ force: true });
  await page.getByRole("button", { name: t.enviarMia }).click();
  await expect(page).toHaveURL(
    new RegExp(`${agendaHref({ dia: tomorrow }).replace("?", "\\?")}$`),
    FIRST_VISIT,
  );
  const own = (await shopBlocks(shop.id)).find((b) => b.barber_id === carlos);
  expect(own?.reason).toBe("Diligencia");
  if (!own) throw new Error("the owner's block was not saved");
  expect(iso(own.starts_at)).toBe(startOfBogotaDay(tomorrow).toISOString());
  expect(iso(own.ends_at)).toBe(
    startOfBogotaDay(addDays(tomorrow, 1)).toISOString(),
  );

  // The public page: Carlos has no hours tomorrow, Ana does.
  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Carlos");
  await expect(
    page
      .getByRole("img", {
        name: textos.reservas.hora.cerrado(
          capitalize(formatCalendarDay(tomorrow)),
        ),
      })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.goto(`/${shop.slug}`);
  await chooseServicesAndBarber(page, "Ana");
  await chooseTomorrowAt(page, "10:00");

  // Now the whole establishment, in two days from 1:00 to 2:00 p. m.
  const inTwoDays = addDays(today, 2);
  await page.goto(blockHref());
  await expect(
    page.getByRole("heading", { level: 1, name: t.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("radio", { name: t.opciones.shop.titulo })
    .check({ force: true });
  await expect(
    page.getByRole("button", { name: t.enviarEstablecimiento }),
  ).toBeVisible();
  // The closed day is closed for everyone too.
  await expect(
    page
      .getByRole("combobox", { name: t.dia })
      .locator(`option[value="${closedDay}"]`),
  ).toBeDisabled();
  await page.getByRole("combobox", { name: t.dia }).selectOption(inTwoDays);
  await page.getByRole("combobox", { name: t.desde }).selectOption("13:00");
  await page.getByRole("combobox", { name: t.hasta }).selectOption("14:00");
  await page.getByRole("radio", { name: "Otro" }).check({ force: true });
  await page.getByRole("button", { name: t.enviarEstablecimiento }).click();
  await expect(page).toHaveURL(
    new RegExp(`${agendaHref({ dia: inTwoDays }).replace("?", "\\?")}$`),
    FIRST_VISIT,
  );
  const closure = (await shopBlocks(shop.id)).find(
    (b) =>
      b.barber_id === null &&
      iso(b.starts_at) === fromBogota(inTwoDays, "13:00").toISOString(),
  );
  expect(closure && iso(closure.ends_at)).toBe(
    fromBogota(inTwoDays, "14:00").toISOString(),
  );
});
