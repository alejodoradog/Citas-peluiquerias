import { expect, test, type Page } from "@playwright/test";
import { addDays, toBogotaDate } from "../../src/lib/fechas/fechas";
import { textos } from "../../src/ui/textos";
import { seedAppointment } from "./helpers/agenda";
import { signInOwner } from "./helpers/clientes";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import { FIRST_VISIT } from "./helpers/reserva";
import {
  acceptedTermsOf,
  authAccountExists,
  createBookableShop,
  insertCustomer,
  latestEmailLink,
  setBarberEmail,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.6b (decision 0010): the owner invites a professional from their
// card, the professional opens the email, creates their password accepting
// the terms, and uses "Mi agenda" with their own session; then the owner
// takes the access away and the professional no longer gets in. A
// professional never opens the panel, nor an owner "Mi agenda".
const acceso = textos.barberos.acceso;
const b = textos.barbero;
const m = textos.miAgenda;

// The start of the quarter hour `minutes` ago: an appointment that already
// started, so it can be marked.
function startedAgo(minutes: number): Date {
  const quarter = 15 * 60_000;
  return new Date(
    Math.floor((Date.now() - minutes * 60_000) / quarter) * quarter,
  );
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

test("the owner invites a professional, who uses Mi agenda until the owner takes the access away", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const shop = await createBookableShop("profesional");
  const email = uniqueEmail("ana-profesional");
  const password = "clave-de-ana-1";
  await setBarberEmail(shop.barbers.ana, email);
  const customer = await insertCustomer(shop.id, {
    name: "Felipe Ramírez",
    phone: "+573001234567",
  });
  const appointment = await seedAppointment({
    barbershopId: shop.id,
    customerId: customer,
    barberId: shop.barbers.ana,
    startsAt: startedAgo(30),
    serviceIds: [shop.services.corte],
  });

  // The owner's card: "Acceso a su agenda", not invited yet.
  await signInOwner(page, shop.owner);
  await page.goto(`/panel/profesionales/${shop.barbers.ana}`);
  const section = page.getByRole("region", { name: acceso.titulo });
  await expect(section).toBeVisible(FIRST_VISIT);
  await expect(section.getByText(acceso.chips.sinInvitar)).toBeVisible();
  await checkScreen(page);
  await section.getByRole("button", { name: acceso.invitar }).click();
  await expect(section.getByText(acceso.enviada)).toBeVisible();
  // The card reads the database again (router.refresh).
  await expect(section.getByText(acceso.chips.invitado)).toBeVisible(
    FIRST_VISIT,
  );
  await expect(
    section.getByRole("button", { name: acceso.reenviar }),
  ).toBeVisible();

  // The owner never opens "Mi agenda": back to the panel.
  await page.goto("/mi-agenda");
  await expect(page).toHaveURL(/\/panel/, FIRST_VISIT);

  // The professional, on their own phone.
  const phone = await browser.newContext({ ...test.info().project.use });
  const pro = await phone.newPage();
  const link = await latestEmailLink(email, "invite");
  await pro.goto(link);
  // A tap first, so an email scanner does not spend the link.
  await pro
    .getByRole("button", { name: textos.cuentas.confirmar.continuar })
    .click(FIRST_VISIT);
  await expect(pro).toHaveURL(/\/nueva-clave$/, FIRST_VISIT);
  await expect(
    pro.getByRole("heading", { name: textos.cuentas.invitacion.titulo }),
  ).toBeVisible();
  await checkScreen(pro);
  // The passwords are never sent back, so they are written each time.
  const fillPasswords = async () => {
    await pro
      .getByRole("textbox", {
        name: textos.cuentas.invitacion.campos.password,
        exact: true,
      })
      .fill(password);
    await pro
      .getByRole("textbox", {
        name: textos.cuentas.nuevaClave.campos.confirmation,
      })
      .fill(password);
  };
  await fillPasswords();
  // Without the terms it does not go on.
  await pro
    .getByRole("button", { name: textos.cuentas.invitacion.enviar })
    .click();
  await expect(
    pro.getByText(textos.cuentas.errores.terms_required),
  ).toBeVisible();
  await pro
    .getByRole("checkbox", { name: textos.legal.casilla.registro })
    .check({ force: true });
  await fillPasswords();
  await pro
    .getByRole("button", { name: textos.cuentas.invitacion.enviar })
    .click();

  // "Mi agenda", with their appointment.
  await expect(pro).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);
  await expect(
    pro.getByRole("heading", { level: 1, name: b.hola("Ana") }),
  ).toBeVisible(FIRST_VISIT);
  await expect(pro.getByText("Felipe R.")).toBeVisible();
  await expect(
    pro.getByRole("button", { name: m.compartir.boton }),
  ).toBeVisible();
  await expect(pro.getByText(/\$/)).toHaveCount(0);
  await expect(pro.getByText("Beto")).toHaveCount(0);
  await checkScreen(pro);
  expect((await acceptedTermsOf(email))?.terms_version).toBe(
    textos.legal.version,
  );

  // Marks it.
  await pro
    .getByRole("button", { name: b.marcar.atendidaDe("Felipe R.") })
    .click();
  await expect(
    pro.getByRole("button", { name: b.marcar.atendidaDe("Felipe R.") }),
  ).toHaveCount(0);

  // B-03, with the customer's WhatsApp.
  await pro.getByRole("link", { name: /Felipe R\./ }).click();
  await expect(pro).toHaveURL(
    new RegExp(`/mi-agenda/citas/${appointment}$`),
    FIRST_VISIT,
  );
  const whatsapp = pro.getByRole("link", { name: m.whatsappDe("Felipe R.") });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/573001234567");
  await checkScreen(pro);

  // B-04: blocks an hour.
  await pro.goto("/mi-agenda/bloquear");
  await expect(
    pro.getByRole("heading", { name: b.bloquear.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await checkScreen(pro);
  const tomorrow = addDays(toBogotaDate(new Date()), 1);
  await pro
    .getByRole("combobox", { name: b.bloquear.dia })
    .selectOption(tomorrow);
  await pro
    .getByRole("combobox", { name: b.bloquear.desde })
    .selectOption("10:00");
  await pro
    .getByRole("combobox", { name: b.bloquear.hasta })
    .selectOption("11:00");
  await pro
    .getByRole("radio", { name: b.bloquear.motivos.lunch })
    .check({ force: true });
  await pro.getByRole("button", { name: b.bloquear.enviar }).click();
  await expect(pro).toHaveURL(
    new RegExp(`/mi-agenda\\?dia=${tomorrow}$`),
    FIRST_VISIT,
  );
  const lunch = `${b.bloquear.motivos.lunch} · ${textos.agenda.minutos(60)}`;
  await expect(
    pro.getByRole("button", { name: b.quitarDe(lunch) }),
  ).toBeVisible();

  // A professional never opens the panel nor the platform.
  await pro.goto("/panel");
  await expect(pro).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);
  await pro.goto("/admin");
  await expect(pro).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);
  await pro.goto("/ingresar");
  await expect(pro).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);

  // The owner takes the access away.
  await page.goto(`/panel/profesionales/${shop.barbers.ana}`);
  await expect(section.getByText(acceso.chips.conAcceso)).toBeVisible(
    FIRST_VISIT,
  );
  await section.getByRole("button", { name: acceso.quitar }).click();
  await page.getByRole("button", { name: acceso.confirmar.si }).click();
  await expect(section.getByText(acceso.chips.quitado)).toBeVisible(
    FIRST_VISIT,
  );
  expect(await authAccountExists(email)).toBe(false);

  // The professional is out, and their password no longer works.
  await pro.goto("/mi-agenda");
  await expect(pro).toHaveURL(/\/ingresar/, FIRST_VISIT);
  const ingreso = textos.cuentas.ingreso;
  await pro.getByRole("textbox", { name: ingreso.campos.email }).fill(email);
  await pro
    .getByLabel(ingreso.campos.password)
    .filter({ visible: true })
    .fill(password);
  await pro.getByRole("button", { name: ingreso.enviar }).click();
  await expect(
    pro.getByText(textos.cuentas.errores.invalid_credentials),
  ).toBeVisible();
  await phone.close();
});

test("an invitation link that does not work says to ask the owner again", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=no-sirve&type=invite");
  await page
    .getByRole("button", { name: textos.cuentas.confirmar.continuar })
    .click(FIRST_VISIT);
  await expect(page).toHaveURL(/invitacion=vencida/, FIRST_VISIT);
  await expect(
    page.getByText(textos.cuentas.invitacion.vencida.titulo),
  ).toBeVisible();
});
