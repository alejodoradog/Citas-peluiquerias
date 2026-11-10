import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
  expectVisibleFocus,
} from "./helpers/pantalla";

// Screens of task 2.0 that need no account (D-01 to D-09 without a session,
// the legal pages and the component catalog), on Android and iPhone. None of
// them writes to Supabase.
const t = textos.cuentas;

async function checkScreen(page: Page, browserName: string) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
  // Tab does not reach links in WebKit by default; Chromium checks focus.
  if (browserName === "chromium") await expectVisibleFocus(page);
  await expect(page.locator("body")).not.toContainText(/silla/i);
  await expect(page).toHaveTitle(/Yapoin/);
}

const screens: Array<{ id: string; path: string; heading: string }> = [
  { id: "D-01", path: "/", heading: textos.inicio.titulo },
  { id: "D-02", path: "/registro", heading: t.registro.titulo },
  {
    id: "D-04",
    path: "/auth/confirm?token_hash=prueba&type=signup",
    heading: t.confirmar.titulo,
  },
  {
    id: "D-04 sin link",
    path: "/auth/confirm?type=signup",
    heading: t.confirmar.titulo,
  },
  { id: "D-05", path: "/ingresar", heading: t.ingreso.titulo },
  {
    id: "D-05 correo confirmado",
    path: "/ingresar?confirmado=1",
    heading: t.ingreso.titulo,
  },
  {
    id: "D-05 link vencido",
    path: "/ingresar?vencido=1",
    heading: t.ingreso.titulo,
  },
  { id: "D-07", path: "/recuperar-clave", heading: t.recuperar.titulo },
  {
    id: "D-07 link vencido",
    path: "/recuperar-clave?vencido=1",
    heading: t.recuperar.titulo,
  },
  { id: "D-09 sin link", path: "/nueva-clave", heading: t.nuevaClave.titulo },
  {
    id: "términos",
    path: "/terminos",
    heading: textos.legal.terminos.titulo,
  },
  {
    id: "política de datos",
    path: "/privacidad",
    heading: textos.legal.privacidad.titulo,
  },
];

for (const screen of screens) {
  test(`${screen.id} meets the F-01 rules @ui`, async ({
    page,
    browserName,
  }) => {
    await page.goto(screen.path);
    await expect(
      page.getByRole("heading", { level: 1, name: screen.heading }),
    ).toBeVisible();
    await checkScreen(page, browserName);
  });
}

test("D-01 offers to sign up and to sign in @ui", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(page.getByText(textos.marca, { exact: true })).toBeVisible();
  for (const benefit of textos.inicio.beneficios) {
    await expect(page.getByText(benefit)).toBeVisible();
  }
  await expect(page.getByText(textos.inicio.nota)).toBeVisible();
  await page.getByRole("link", { name: textos.inicio.crearCuenta }).click();
  await expect(page).toHaveURL(/\/registro$/);
});

test("D-02 links the terms and the data policy @ui", async ({ page }) => {
  await page.goto("/registro");
  await expect(page.getByText(textos.ui.paso(1, 3))).toBeAttached();
  await page.getByRole("link", { name: t.registro.legal.terminos }).click();
  await expect(page).toHaveURL(/\/terminos$/);
});

test("D-02 shows its errors in red and moves to the first one @ui", async ({
  page,
  browserName,
}) => {
  await page.goto("/registro");
  await page.getByLabel(t.registro.campos.phone).fill("123");
  await page.getByRole("button", { name: t.registro.enviar }).click();
  const owner = page.getByLabel(t.registro.campos.ownerName);
  await expect(owner).toHaveAttribute("aria-invalid", "true");
  await expect(owner).toBeFocused();
  await expect(
    page.getByText(textos.barberias.errores.phone_invalid),
  ).toBeVisible();
  await checkScreen(page, browserName);
});

test("D-06 says what is missing @ui", async ({ page, browserName }) => {
  await page.goto("/ingresar");
  await page.getByLabel(t.ingreso.campos.email).fill("dueno@correo.com");
  await page.getByRole("button", { name: t.ingreso.enviar }).click();
  await expect(page.getByText(t.errores.password_required)).toBeVisible();
  await expect(page.getByLabel(t.ingreso.campos.password)).toBeFocused();
  await checkScreen(page, browserName);
});

test("the component catalog meets the F-01 rules @ui", async ({
  page,
  browserName,
}) => {
  await page.goto("/_catalogo");
  await checkScreen(page, browserName);

  // Switches and checkboxes work with a real keyboard.
  const notices = page.getByRole("switch", { name: "Reservas en línea" });
  await notices.focus();
  await page.keyboard.press("Space");
  await expect(notices).toBeChecked();
  const box = page.getByRole("checkbox", { name: "Corte" });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();

  // The floating button never covers the bottom bar.
  const fab = await page
    .getByRole("link", { name: textos.ui.nuevaCita })
    .boundingBox();
  const nav = await page
    .getByRole("navigation", { name: textos.ui.navegacion.etiqueta })
    .boundingBox();
  expect(fab && nav && fab.y + fab.height <= nav.y).toBe(true);
});

test("loading blocks stand still for reduced motion @ui", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/_catalogo");
  const block = page.locator('[aria-busy="true"] > div').first();
  const animation = await block.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animation).toBe("none");
});
