import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import {
  createBookableShop,
  createSuperAdmin,
  requireLocalSupabaseUrl,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.8b: the owner of plan 1 hits the limit, asks for plan 2 in Más ›
// Plan, the super admin accepts it by registering the payment, and the fifth
// professional is saved.
const PASSWORD = "clave-segura-1";
const FIRST_VISIT = { timeout: 20_000 };
const p = textos.planes;
const t = textos.plataforma;
const s = t.solicitudes;

function admin() {
  return createClient(
    requireLocalSupabaseUrl(),
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signIn(page: Page, email: string, landing: RegExp) {
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.password })
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await expect(page).toHaveURL(landing, FIRST_VISIT);
}

async function addProfessional(page: Page, name: string) {
  await page.goto("/panel/profesionales/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: textos.barberos.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("textbox", { name: textos.barberos.campos.nombre })
    .fill(name);
  await page.getByRole("button", { name: textos.barberos.guardar }).click();
}

test("the owner asks for plan 2, the admin accepts, and the fifth professional fits", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const shopName = `Barbería Cambio ${Date.now().toString(36)}`;
  const shop = await createBookableShop("cambiar-plan", shopName);
  const db = admin();
  const active = async () => {
    const { count, error } = await db
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", shop.id)
      .eq("active", true);
    if (error) throw error;
    return count ?? 0;
  };
  let n = await active();
  while (n < 4) {
    const { error } = await db.from("barbers").insert({
      barbershop_id: shop.id,
      display_name: `Extra ${n}`,
      sort_order: 200 + n,
      link_token_hash: randomBytes(32).toString("hex"),
    });
    if (error) throw error;
    n = await active();
  }
  expect(n).toBe(4);

  // The owner hits the limit.
  await signIn(page, shop.owner.email, /\/panel$/);
  await addProfessional(page, "Quinto");
  await expect(
    page.getByText(textos.barberos.errores.plan_limit).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);
  expect(await active()).toBe(4);

  // Más › Plan.
  await page.goto("/panel/mas");
  await page
    .getByRole("link", { name: new RegExp(p.plan.fila) })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/panel\/plan$/, FIRST_VISIT);
  await expect(
    page.getByRole("heading", { level: 1, name: p.plan.titulo }),
  ).toBeVisible(FIRST_VISIT);
  await expectAccessible(page);
  await expectTouchTargets(page);

  await page
    .getByRole("button", { name: p.plan.subir.boton })
    .filter({ visible: true })
    .click();
  const sheet = page.getByRole("dialog", { name: p.plan.hoja.titulo });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: p.plan.hoja.enviar }).click();
  await expect(page).toHaveURL(/\/panel\/plan\?hecho=solicitud$/, FIRST_VISIT);
  await expect(
    page.getByText(p.plan.hecho.solicitud!).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(p.plan.pendiente.titulo).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: p.plan.pendiente.cancelar })
      .filter({ visible: true }),
  ).toBeVisible();

  // The super admin, in another browser context.
  const context = await browser.newContext();
  try {
    const adminPage = await context.newPage();
    const adminEmail = uniqueEmail("cambiar-plan-admin");
    await createSuperAdmin(adminEmail, PASSWORD);
    await signIn(adminPage, adminEmail, /\/admin$/);
    const link = adminPage.getByRole("link", {
      name: new RegExp(`^${s.titulo} · \\d+ pendientes?`),
    });
    await expect(link).toBeVisible(FIRST_VISIT);
    await link.click();
    await expect(adminPage).toHaveURL(/\/admin\/solicitudes$/, FIRST_VISIT);
    await expect(
      adminPage.getByRole("heading", { level: 1, name: s.titulo }),
    ).toBeVisible(FIRST_VISIT);
    const card = adminPage.getByRole("listitem").filter({ hasText: shopName });
    await expect(card).toBeVisible();
    await expectAccessible(adminPage);
    await expectTouchTargets(adminPage);

    await card.getByRole("button", { name: s.aceptar }).click();
    const accept = adminPage.getByRole("dialog", {
      name: s.hojaAceptar.titulo,
    });
    await expect(accept).toBeVisible();
    await accept
      .getByRole("combobox", { name: t.pago.medio })
      .selectOption("nequi");
    await accept
      .getByRole("textbox", { name: t.pago.referencia })
      .fill(`NEQ-CAMBIO-${randomBytes(4).toString("hex")}`);
    await accept.getByRole("button", { name: s.hojaAceptar.enviar }).click();
    await expect(adminPage).toHaveURL(/hecho=aceptada/, FIRST_VISIT);
    await expect(
      adminPage.getByText(s.hecho.aceptada!).filter({ visible: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }

  // The fifth professional is saved now.
  await addProfessional(page, "Quinto");
  await expect(page).not.toHaveURL(
    /\/panel\/profesionales\/nuevo$/,
    FIRST_VISIT,
  );
  expect(await active()).toBe(5);
});
