import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { fillSetupServices, passLocationStep } from "./helpers/asistente";
import { expectAccessible, expectTouchTargets } from "./helpers/pantalla";
import {
  createBookableShop,
  latestEmailLink,
  requireLocalSupabaseUrl,
  uniqueEmail,
} from "./helpers/supabase";

// Task 7.8a: the plan is chosen on the landing and at sign-up; plan 2 starts
// without trial, and plan 1 allows up to 4 active professionals.
const PASSWORD = "clave-segura-1";
const FIRST_VISIT = { timeout: 20_000 };
const c = textos.cuentas;
const p = textos.planes;

function admin() {
  return createClient(
    requireLocalSupabaseUrl(),
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signIn(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel(c.ingreso.campos.email).fill(email);
  await page.getByLabel(c.ingreso.campos.password).fill(PASSWORD);
  await page.getByRole("button", { name: c.ingreso.enviar }).click();
}

// The barbershop of an owner, read past RLS.
async function shopOf(email: string) {
  const db = admin();
  const { data: users, error } = await db.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  const user = users.users.find((one) => one.email === email)!;
  const { data, error: shopError } = await db
    .from("memberships")
    .select("barbershops(id, slug, selected_plan, trial_ends_on)")
    .eq("user_id", user.id)
    .single();
  if (shopError) throw shopError;
  return data.barbershops as unknown as {
    id: string;
    slug: string;
    selected_plan: string;
    trial_ends_on: string | null;
  };
}

test("tapping plan 2 on the landing opens the sign-up with it chosen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: textos.landing.precios.abrir })
    .click();
  const prices = page.getByRole("dialog", {
    name: textos.landing.precios.titulo,
  });
  await prices
    .getByRole("link", {
      name: new RegExp(`^${textos.landing.precios.planes[1]!.elegir}`),
    })
    .click();
  await expectPlan2Chosen(page);

  // The form must take what is typed.
  const name = page.getByRole("textbox", { name: c.registro.campos.ownerName });
  await name.fill("Carlos Pérez");
  await expect(name).toHaveValue("Carlos Pérez");
});

async function expectPlan2Chosen(page: Page) {
  await expect(page).toHaveURL(/\/registro\?plan=2$/, FIRST_VISIT);
  await expect(
    page.getByRole("radio", { name: new RegExp(p.registro.plan2.nombre) }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: new RegExp(p.registro.plan1.nombre) }),
  ).not.toBeChecked();
  await expect(page.getByText(p.registro.bajadaPlan2)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
}

test("signing up with plan 2 has no trial and holds the bookings", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/registro?plan=2");
  await expectPlan2Chosen(page);

  const email = uniqueEmail("plan2");
  const r = c.registro;
  await page.getByLabel(r.campos.ownerName).fill("Carlos Pérez");
  await page.getByLabel(r.campos.barbershopName).fill("Barbería El Parche");
  await page
    .getByRole("combobox", { name: r.campos.businessType })
    .selectOption("barbershop");
  await page.getByLabel(r.campos.phone).fill("300 123 4567");
  await page.getByLabel(r.campos.email).fill(email);
  await page.getByLabel(r.campos.password).fill(PASSWORD);
  await page
    .getByRole("checkbox", { name: textos.legal.casilla.registro })
    .check({ force: true });
  await page.getByRole("button", { name: r.enviar }).click();
  await expect(
    page.getByRole("heading", { name: r.revisaCorreo.titulo }),
  ).toBeVisible();

  await page.goto(await latestEmailLink(email, "signup"));
  await page.getByRole("button", { name: c.confirmar.continuar }).click();
  await expect(page).toHaveURL(/\/ingresar\?confirmado=1$/);
  await signIn(page, email);

  // The wizard, up to its last screen: it asks for the first payment.
  const t = textos.asistente;
  await expect(page).toHaveURL(/\/panel\/configurar$/, FIRST_VISIT);
  await fillSetupServices(page);
  await page.getByRole("link", { name: t.servicios.continuar }).click();
  await passLocationStep(page);
  await expect(page).toHaveURL(/\/panel\/configurar\/equipo$/, FIRST_VISIT);
  await page.getByRole("button", { name: t.equipo.terminar }).click();
  await expect(page).toHaveURL(/\/panel\/configurar\/listo$/, FIRST_VISIT);
  await expect(
    page.getByText(p.listo.primerPago).filter({ visible: true }),
  ).toBeVisible();

  const shop = await shopOf(email);
  expect(shop.selected_plan).toBe("plus");

  await page.getByRole("link", { name: t.listo.agenda }).click();
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
  await expect(
    page.getByText(textos.suscripcion.pausadaPrimerPago).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);

  // The public page takes no bookings.
  await page.goto(`/${shop.slug}`);
  await expect(
    page.getByText(textos.reservas.suspendida.titulo),
  ).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: textos.reservas.perfil.reservar }),
  ).toHaveCount(0);
});

test("plan 1 stops at 4 active professionals", async ({ page }) => {
  test.setTimeout(120_000);
  const shop = await createBookableShop("plan-limite");
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
  // Up to 4 active ones, past the app.
  let n = await active();
  const { data: row } = await db
    .from("barbershops")
    .select("selected_plan")
    .eq("id", shop.id)
    .single();
  expect(row?.selected_plan).toBe("standard");
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

  await signIn(page, shop.owner.email);
  await expect(page).toHaveURL(/\/panel$/, FIRST_VISIT);
  await page.goto("/panel/profesionales/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: textos.barberos.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page
    .getByRole("textbox", { name: textos.barberos.campos.nombre })
    .fill("Quinto");
  await page.getByRole("button", { name: textos.barberos.guardar }).click();
  await expect(
    page.getByText(textos.barberos.errores.plan_limit).filter({
      visible: true,
    }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page).toHaveURL(/\/panel\/profesionales\/nuevo$/);
  expect(await active()).toBe(4);
});
