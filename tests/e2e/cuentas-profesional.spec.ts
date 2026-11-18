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
  inviteAnswer,
  inviteProfessional,
  latestEmailLink,
  setBarberEmail,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.6b (decision 0010), changed by task 8.16: the invitation goes out
// when the owner saves the professional's email (no "Invitar" tap); the
// professional opens the email, creates their password accepting
// the terms, and uses "Mi agenda" with their own session; then the owner
// takes the access away and the professional no longer gets in. A
// professional never opens the panel, nor an owner "Mi agenda".
const acceso = textos.barberos.acceso;
const b = textos.barbero;
const m = textos.miAgenda;
// The name createBookableShop gives the establishment.
const SHOP_NAME = "Barbería La Esquina";

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

test("saving a professional's email invites them, and they use Mi agenda until the owner takes the access away", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const shop = await createBookableShop("profesional");
  const email = uniqueEmail("ana-profesional");
  const password = "clave-de-ana-1";
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

  // The owner's card: "Acceso a su agenda", with no email yet.
  await signInOwner(page, shop.owner);
  await page.goto(`/panel/profesionales/${shop.barbers.ana}`);
  const section = page.getByRole("region", { name: acceso.titulo });
  await expect(section).toBeVisible(FIRST_VISIT);
  await expect(section.getByText(acceso.chips.sinCorreo)).toBeVisible();
  await checkScreen(page);
  // Writing the email and saving is all it takes: the invitation goes out.
  await page
    .getByRole("textbox", { name: new RegExp(textos.barberos.campos.correo) })
    .fill(email);
  await page.getByRole("button", { name: textos.barberos.guardar }).click();
  await expect(page).toHaveURL(
    /\/panel\/profesionales\?invitacion=sent/,
    FIRST_VISIT,
  );
  await expect(
    page.getByText(acceso.alGuardar.enviada(email)).filter({ visible: true }),
  ).toBeVisible();
  await checkScreen(page);
  // Back to the card: the invitation is pending.
  await page.goto(`/panel/profesionales/${shop.barbers.ana}`);
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
  // A tap first, so an email scanner does not spend the link. The screen
  // says it is an invitation (task 8.11), not yet from whom.
  await expect(
    pro.getByRole("heading", {
      name: textos.cuentas.invitacion.abrir.titulo,
    }),
  ).toBeVisible(FIRST_VISIT);
  await expect(pro.getByText(SHOP_NAME)).toHaveCount(0);
  await checkScreen(pro);
  await pro
    .getByRole("button", { name: textos.cuentas.invitacion.abrir.continuar })
    .click(FIRST_VISIT);
  await expect(pro).toHaveURL(/\/nueva-clave$/, FIRST_VISIT);
  // Who invites, read from the database with the session just opened.
  await expect(
    pro.getByRole("heading", {
      name: textos.cuentas.invitacion.invita(SHOP_NAME),
    }),
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
    .getByRole("button", { name: textos.cuentas.invitacion.abrir.continuar })
    .click(FIRST_VISIT);
  await expect(page).toHaveURL(/invitacion=vencida/, FIRST_VISIT);
  await expect(
    page.getByText(textos.cuentas.invitacion.vencida.titulo),
  ).toBeVisible();
});

// Review of task 7.6b, point 4: opening the invitation confirms the email,
// so once its session is old the owner can no longer resend it. The way in
// is "¿Olvidaste tu contraseña?", which works for an account that never set
// a password and still goes through the terms.
test("a professional who opened the invitation but never set a password gets in by recovering it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shop = await createBookableShop("profesional-recupera");
  const email = uniqueEmail("beto-profesional");
  await setBarberEmail(shop.barbers.beto, email);
  await inviteProfessional(shop.owner, shop.barbers.beto);

  // Opens the invitation and leaves without creating the password.
  await page.goto(await latestEmailLink(email, "invite"));
  await page
    .getByRole("button", { name: textos.cuentas.invitacion.abrir.continuar })
    .click(FIRST_VISIT);
  await expect(page).toHaveURL(/\/nueva-clave$/, FIRST_VISIT);
  // The email is confirmed now: the owner cannot resend it.
  expect(await inviteAnswer(shop.owner, shop.barbers.beto)).toBe(
    "already_linked",
  );
  // Without the terms, "Mi agenda" sends them back to accept them.
  await page.goto("/mi-agenda");
  await expect(page).toHaveURL(/\/nueva-clave$/, FIRST_VISIT);

  // "¿Olvidaste tu contraseña?"
  const r = textos.cuentas.recuperar;
  await page.goto("/recuperar-clave");
  await page.getByRole("textbox", { name: r.campos.email }).fill(email);
  await page.getByRole("button", { name: r.enviar }).click();
  await expect(page.getByText(r.enviado)).toBeVisible(FIRST_VISIT);
  await page.goto(await latestEmailLink(email, "recovery"));
  await page
    .getByRole("button", { name: textos.cuentas.confirmar.continuar })
    .click(FIRST_VISIT);
  await expect(page).toHaveURL(/\/nueva-clave$/, FIRST_VISIT);

  // The same welcome: password and terms, then their agenda.
  await expect(
    page.getByRole("heading", {
      name: textos.cuentas.invitacion.invita(SHOP_NAME),
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", {
      name: textos.cuentas.invitacion.campos.password,
      exact: true,
    })
    .fill("clave-de-beto-1");
  await page
    .getByRole("textbox", {
      name: textos.cuentas.nuevaClave.campos.confirmation,
    })
    .fill("clave-de-beto-1");
  await page
    .getByRole("checkbox", { name: textos.legal.casilla.registro })
    .check({ force: true });
  await page
    .getByRole("button", { name: textos.cuentas.invitacion.enviar })
    .click();
  await expect(page).toHaveURL(/\/mi-agenda$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: b.hola("Beto") }),
  ).toBeVisible(FIRST_VISIT);
  expect((await acceptedTermsOf(email))?.terms_version).toBe(
    textos.legal.version,
  );
});
