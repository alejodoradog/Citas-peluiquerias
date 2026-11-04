import { expect, test, type Page } from "@playwright/test";
import {
  formatBogotaDate,
  startOfBogotaDay,
  toBogotaDate,
} from "../../src/lib/fechas/fechas";
import { trialEndsOn } from "../../src/modulos/suscripciones/dominio/trial";
import { textos } from "../../src/ui/textos";
import {
  createAccountWithoutProfile,
  createSuperAdmin,
  latestRecoveryLink,
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

test("an owner signs up and lands on the panel with the free trial running", async ({
  page,
}) => {
  await register(page, { email: uniqueEmail("registro") });

  await expect(page).toHaveURL(/\/panel$/);
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

test("the signup form explains what to fix", async ({ page }) => {
  await register(page, { email: uniqueEmail("celular"), phone: "123" });

  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByText(t.errores.phone_invalid)).toBeVisible();
  await expect(page.getByLabel(t.registro.campos.ownerName)).toHaveValue(
    "Carlos Pérez",
  );
});

test("an email can only have one account", async ({ page, browser }) => {
  const email = uniqueEmail("repetido");
  await register(page, { email });
  await expect(page).toHaveURL(/\/panel$/);

  const other = await browser.newPage();
  await register(other, { email, barbershop: "Otra Barbería" });
  await expect(other.getByText(t.errores.email_taken)).toBeVisible();
  await other.close();
});

test("an owner signs out and signs back in", async ({ page }) => {
  const email = uniqueEmail("ingreso");
  await register(page, { email });
  await signOut(page);

  await signIn(page, email, "otra-clave-mala");
  await expect(page.getByText(t.errores.invalid_credentials)).toBeVisible();

  await signIn(page, email);
  await expect(page).toHaveURL(/\/panel$/);
});

test("an owner recovers access by email", async ({ page }) => {
  const email = uniqueEmail("recuperar");
  await register(page, { email });
  await signOut(page);

  await page.goto("/recuperar-clave");
  await page.getByLabel(t.recuperar.campos.email).fill(email);
  await page.getByRole("button", { name: t.recuperar.enviar }).click();
  await expect(page.getByText(t.recuperar.enviado)).toBeVisible();

  await page.goto(await latestRecoveryLink(email));
  await page.getByRole("button", { name: t.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/nueva-clave$/);

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
  await register(page, { email: uniqueEmail("sin-link") });
  await expect(page).toHaveURL(/\/panel$/);

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

  await register(page, { email: uniqueEmail("dueno") });
  await expect(page).toHaveURL(/\/panel$/);
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
