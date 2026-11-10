import { expect, test, type Page } from "@playwright/test";
import {
  formatBogotaDate,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { trialEndsOn } from "../../src/modulos/suscripciones/dominio/trial";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import {
  createAccountWithoutProfile,
  createSuperAdmin,
  emailCount,
  latestEmailLink,
  uniqueEmail,
} from "./helpers/supabase";

const t = textos.cuentas;
const PASSWORD = "clave-segura-1";

async function register(
  page: Page,
  {
    email,
    phone = "300 123 4567",
    barbershop = "Barbería El Parche",
  }: { email: string; phone?: string; barbershop?: string },
) {
  await page.goto("/registro");
  await page.getByLabel(t.registro.campos.ownerName).fill("Carlos Pérez");
  await page.getByLabel(t.registro.campos.barbershopName).fill(barbershop);
  await page.getByLabel(t.registro.campos.phone).fill(phone);
  await page.getByLabel(t.registro.campos.email).fill(email);
  await page.getByLabel(t.registro.campos.password).fill(PASSWORD);
  await page.getByRole("button", { name: t.registro.enviar }).click();
}

// Confirming does not sign in: the owner then enters with their password.
async function confirmEmail(page: Page, email: string) {
  await page.goto(await latestEmailLink(email, "signup"));
  await page.getByRole("button", { name: t.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/ingresar\?confirmado=1$/);
  await expect(page.getByText(t.ingreso.correoConfirmado.titulo)).toBeVisible();

  await signIn(page, email);
  await expect(page).toHaveURL(/\/panel$/);
}

async function registerAndConfirm(
  page: Page,
  account: { email: string; barbershop?: string },
) {
  await register(page, account);
  await expect(
    page.getByRole("heading", { name: t.registro.revisaCorreo.titulo }),
  ).toBeVisible();
  await confirmEmail(page, account.email);
}

// Waits until signing out finished: otherwise its response can arrive after
// the next sign-in and clear the new session.
async function signOut(page: Page) {
  await page.getByRole("button", { name: t.salir }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/ingresar");
  await page.getByLabel(t.ingreso.campos.email).fill(email);
  await page.getByLabel(t.ingreso.campos.password).fill(password);
  await page.getByRole("button", { name: t.ingreso.enviar }).click();
}

test("an owner signs up, confirms their email and sees the free trial running", async ({
  page,
}) => {
  await registerAndConfirm(page, { email: uniqueEmail("registro") });

  await expect(
    page.getByRole("heading", { name: textos.panel.saludo("Carlos Pérez") }),
  ).toBeVisible();
  await expect(
    page.getByText("Barbería El Parche", { exact: true }),
  ).toBeVisible();
  const trialEnd = formatBogotaDate(
    startOfBogotaDay(trialEndsOn(toBogotaDate(new Date()))),
  );
  await expect(page.getByText(textos.panel.prueba(trialEnd))).toBeVisible();
});

test("an owner cannot enter until they confirm their email", async ({
  page,
}) => {
  const email = uniqueEmail("sin-confirmar");
  await register(page, { email });
  await expect(
    page.getByRole("heading", { name: t.registro.revisaCorreo.titulo }),
  ).toBeVisible();
  // D-03 says where the link went and how long it lasts.
  await expect(
    page.getByText(t.registro.revisaCorreo.cuerpo(email)),
  ).toBeVisible();
  await expect(
    page.getByText(t.registro.revisaCorreo.avisoCuerpo),
  ).toBeVisible();
  await expectAccessible(page);
  await expect.poll(() => emailCount(email)).toBe(1);

  // A wrong password reveals nothing and sends nothing (D-06).
  await signIn(page, email, "otra-clave-mala");
  await expect(page.getByRole("alert")).toHaveText(
    t.errores.invalid_credentials,
  );
  await expectAccessible(page);
  expect(await emailCount(email)).toBe(1);

  // Auth allows one email per address each second (max_frequency).
  await page.waitForTimeout(1100);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText(t.errores.email_not_confirmed)).toBeVisible();
  await expect.poll(() => emailCount(email)).toBe(2);

  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);

  await confirmEmail(page, email);
});

test("confirming the email does not allow setting a new password", async ({
  page,
}) => {
  const email = uniqueEmail("confirmo-sin-clave");
  await register(page, { email });
  await expect(
    page.getByRole("heading", { name: t.registro.revisaCorreo.titulo }),
  ).toBeVisible();

  await page.goto(await latestEmailLink(email, "signup"));
  await page.getByRole("button", { name: t.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/ingresar\?confirmado=1$/);

  await page.goto("/nueva-clave");
  await expect(page.getByText(t.nuevaClave.sinSesion)).toBeVisible();
  await expect(page.getByLabel(t.nuevaClave.campos.password)).not.toBeVisible();
});

test("a bad confirmation link sends the owner to sign in", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=falso&type=signup");
  await page.getByRole("button", { name: t.confirmar.continuar }).click();

  await expect(page).toHaveURL(/\/ingresar\?vencido=1$/);
  await expect(page.getByText(t.ingreso.linkVencido)).toBeVisible();
});

test("the signup form explains what to fix", async ({ page }) => {
  await register(page, { email: uniqueEmail("celular"), phone: "123" });

  await expect(page).toHaveURL(/\/registro$/);
  await expect(
    page.getByText(textos.barberias.errores.phone_invalid),
  ).toBeVisible();
  await expect(page.getByLabel(t.registro.campos.ownerName)).toHaveValue(
    "Carlos Pérez",
  );
});

test("signing up with a taken email changes nothing and reveals nothing", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("repetido");
  await registerAndConfirm(page, { email });

  const other = await browser.newPage();
  await register(other, { email, barbershop: "Otra Barbería" });
  await expect(
    other.getByRole("heading", { name: t.registro.revisaCorreo.titulo }),
  ).toBeVisible();
  await other.close();

  await page.reload();
  await expect(
    page.getByText("Barbería El Parche", { exact: true }),
  ).toBeVisible();
});

test("an owner signs out and signs back in", async ({ page }) => {
  const email = uniqueEmail("ingreso");
  await registerAndConfirm(page, { email });
  await signOut(page);

  await signIn(page, email, "otra-clave-mala");
  await expect(page.getByText(t.errores.invalid_credentials)).toBeVisible();

  await signIn(page, email);
  await expect(page).toHaveURL(/\/panel$/);
});

test("an owner recovers access by email", async ({ page }) => {
  const email = uniqueEmail("recuperar");
  await registerAndConfirm(page, { email });
  await signOut(page);

  await page.goto("/recuperar-clave");
  await page.getByLabel(t.recuperar.campos.email).fill(email);
  await page.getByRole("button", { name: t.recuperar.enviar }).click();
  await expect(page.getByText(t.recuperar.enviado)).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: t.recuperar.enviadoTitulo }),
  ).toBeVisible();
  await expectAccessible(page);

  await page.goto(await latestEmailLink(email, "recovery"));
  await page.getByRole("button", { name: t.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/nueva-clave$/);

  await expectAccessible(page);
  await page.getByLabel(t.nuevaClave.campos.password).fill("clave-nueva-2");
  await page.getByLabel(t.nuevaClave.campos.confirmation).fill("clave-nueva-2");
  await page.getByRole("button", { name: t.nuevaClave.enviar }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await signOut(page);
  await signIn(page, email, "clave-nueva-2");
  await expect(page).toHaveURL(/\/panel$/);
});

test("a signed-in owner cannot set a new password without the email link", async ({
  page,
}) => {
  await registerAndConfirm(page, { email: uniqueEmail("sin-link") });

  await page.goto("/nueva-clave");
  await expect(page.getByText(t.nuevaClave.sinSesion)).toBeVisible();
  await expect(page.getByLabel(t.nuevaClave.campos.password)).not.toBeVisible();
});

test("an account without access is told so and can sign out", async ({
  page,
}) => {
  const email = uniqueEmail("sin-acceso");
  await createAccountWithoutProfile(email, PASSWORD);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText(t.ingreso.sinAcceso)).toBeVisible();

  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText(t.ingreso.sinAcceso)).toBeVisible();

  await page.getByRole("button", { name: t.salir }).click();
  await expect(page.getByText(t.ingreso.sinAcceso)).not.toBeVisible();
});

test("a bad recovery link asks for a new one", async ({ page }) => {
  await page.goto(
    "/auth/confirm?token_hash=falso&type=recovery&next=/nueva-clave",
  );
  await page.getByRole("button", { name: t.confirmar.continuar }).click();

  await expect(page).toHaveURL(/\/recuperar-clave\?vencido=1$/);
  await expect(page.getByText(t.recuperar.linkVencido)).toBeVisible();
});

test("the panel and the admin need the right account", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/ingresar$/);

  await registerAndConfirm(page, { email: uniqueEmail("dueno") });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/panel$/);
});

test("a super admin lands on the platform panel", async ({ page }) => {
  const email = uniqueEmail("admin");
  await createSuperAdmin(email, PASSWORD);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: textos.admin.titulo }),
  ).toBeVisible();

  await page.goto("/panel");
  await expect(page).toHaveURL(/\/admin$/);
});

test("the owner's panel has its bottom bar", async ({ page }) => {
  await registerAndConfirm(page, { email: uniqueEmail("barra") });
  const nav = page.getByRole("navigation", {
    name: textos.ui.navegacion.etiqueta,
  });
  await expect(
    nav.getByRole("link", { name: textos.ui.navegacion.agenda }),
  ).toHaveAttribute("aria-current", "page");
  await expectAccessible(page);
  await expectTouchTargets(page);

  await nav.getByRole("link", { name: textos.ui.navegacion.clientes }).click();
  await expect(page).toHaveURL(/\/panel\/clientes$/);
  await expect(
    page.getByRole("heading", { name: textos.panel.secciones.clientes }),
  ).toBeVisible();
  await expect(page.getByText(textos.panel.pronto.titulo)).toBeVisible();
  await expect(
    nav.getByRole("link", { name: textos.ui.navegacion.clientes }),
  ).toHaveAttribute("aria-current", "page");
  await expectAccessible(page);
});

test("the platform panel has no bottom bar", async ({ page }) => {
  const email = uniqueEmail("admin-sin-barra");
  await createSuperAdmin(email, PASSWORD);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expectAccessible(page);
});
