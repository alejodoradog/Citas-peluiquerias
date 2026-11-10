import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { textos } from "../../src/ui/textos";
import { finishSetup } from "./helpers/asistente";
import {
  expectAccessible,
  expectNoZoomOnFocus,
  expectTouchTargets,
} from "./helpers/pantalla";
import {
  barberLinkSnapshot,
  createConfirmedOwner,
  insertBarber,
  setBarberActive,
  uniqueEmail,
} from "./helpers/supabase";

// Task 2.3: the owner issues, replaces and turns off a barber's private link
// (D-53, D-54 and D-56). Owners are created already confirmed, so no email
// is sent.
const t = textos.barberos;
const l = textos.barberos.link;
const PASSWORD = "clave-segura-1";
// The dev server compiles each page the first time it is opened.
const FIRST_VISIT = { timeout: 20_000 };
const AGENDA_LINK = /^https:\/\/yapoin\.com\/b\/([A-Za-z0-9_-]{43})$/;

const sha256 = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

async function signInSetUpOwner(page: Page) {
  const email = uniqueEmail("link-barbero");
  const { slug } = await createConfirmedOwner(email, PASSWORD, {
    ownerName: "Carlos Pérez",
    barbershopName: "Barbería El Parche",
  });
  await page.goto("/ingresar");
  await page
    .getByRole("textbox", { name: textos.cuentas.ingreso.campos.email })
    .fill(email);
  // A password field has no ARIA role, so it goes by its label, among the
  // visible fields only.
  await page
    .getByLabel(textos.cuentas.ingreso.campos.password)
    .filter({ visible: true })
    .fill(PASSWORD);
  await page
    .getByRole("button", { name: textos.cuentas.ingreso.enviar })
    .click();
  await finishSetup(page);
  return { slug };
}

async function checkScreen(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoZoomOnFocus(page);
}

const barberRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(`^${name}\\b`) });

// The link shown right after it is made: its token.
async function shownToken(page: Page): Promise<string> {
  const shown = page
    .getByText(/^https:\/\/yapoin\.com\/b\//)
    .filter({ visible: true })
    .first();
  await expect(shown).toBeVisible(FIRST_VISIT);
  const match = AGENDA_LINK.exec((await shown.textContent())?.trim() ?? "");
  expect(match, "the new link").not.toBeNull();
  return match![1]!;
}

async function expectClipboard(page: Page, token: string) {
  if (test.info().project.name !== "android") return;
  await expect(page.getByText(l.nuevo.copiado).first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `https://yapoin.com/b/${token}`,
  );
}

test("an owner issues, replaces and turns off a barber's private link", async ({
  page,
  context,
}) => {
  // The wizard, D-53, D-54 and D-56 in several states; the dev server
  // compiles each page on first use.
  test.setTimeout(180_000);
  const { slug } = await signInSetUpOwner(page);
  if (test.info().project.name === "android") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }

  // A new barber: D-53 says their link was never sent.
  await page.goto("/panel/barberos/nuevo");
  await expect(
    page.getByRole("heading", { level: 1, name: t.nuevo }),
  ).toBeVisible(FIRST_VISIT);
  await page.getByRole("textbox", { name: t.campos.nombre }).fill("Kevin");
  await page.getByRole("button", { name: t.guardar }).click();
  await expect(page).toHaveURL(/\/panel\/barberos$/, FIRST_VISIT);
  await expect(barberRow(page, "Kevin")).toContainText(t.linkSinEnviar);
  const unsent = await barberLinkSnapshot(slug, "Kevin");
  expect(unsent.active).toBe(true);
  expect(unsent.issuedAt).toBeNull();

  // D-54 → D-56.
  await barberRow(page, "Kevin").click();
  await expect(page).toHaveURL(
    /\/panel\/barberos\/[0-9a-f-]{36}$/,
    FIRST_VISIT,
  );
  const linkRow = page.getByRole("link", {
    name: new RegExp(`^${t.linkPrivado}`),
  });
  await expect(linkRow).toContainText(t.linkSinEnviarAyuda, FIRST_VISIT);
  await expect(linkRow).toContainText(t.linkSinEnviarChip);
  await linkRow.click();
  await expect(page).toHaveURL(
    new RegExp(`/panel/barberos/${unsent.id}/link$`),
    FIRST_VISIT,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: l.titulo("Kevin") }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByText(l.alcance("Kevin"))).toBeVisible();
  await expect(page.getByRole("button", { name: l.desactivar })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Enviar/ })).toHaveCount(0);
  await checkScreen(page);

  // The first link is copied without asking, and shown only now.
  await page.getByRole("button", { name: l.copiarNuevo }).click();
  await expect(page.getByText(l.nuevo.titulo)).toBeVisible(FIRST_VISIT);
  const first = await shownToken(page);
  await expectClipboard(page, first);
  const issued = await barberLinkSnapshot(slug, "Kevin");
  expect(issued.hash).toBe(sha256(first));
  expect(issued.active).toBe(true);
  expect(issued.issuedAt).not.toBeNull();
  await checkScreen(page);

  // It is gone after a reload, and the server never sends it.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: l.titulo("Kevin") }),
  ).toBeVisible(FIRST_VISIT);
  await expect(page.getByText(/^Enviado el /)).toBeVisible();
  await expect(page.getByText(l.nuevo.titulo)).toHaveCount(0);
  expect(await page.content()).not.toContain(first);
  // The HTML of the page itself, as the server sends it to this session.
  const served = await page.request.get(`/panel/barberos/${unsent.id}/link`);
  const html = await served.text();
  expect(served.ok()).toBe(true);
  expect(html).toContain(l.titulo("Kevin"));
  expect(html).not.toContain(first);
  expect(html).not.toContain(issued.hash);

  // A link that works is replaced only after confirming.
  await page.getByRole("button", { name: l.copiarNuevo }).click();
  const replace = page.getByRole("dialog", { name: l.confirmarNuevo.titulo });
  await expect(replace).toContainText(l.confirmarNuevo.cuerpo("Kevin"));
  await checkScreen(page);
  await replace.getByRole("button", { name: l.confirmarNuevo.si }).click();
  await expect(page.getByText(l.nuevo.titulo)).toBeVisible(FIRST_VISIT);
  const second = await shownToken(page);
  expect(second).not.toBe(first);
  await expectClipboard(page, second);
  const replaced = await barberLinkSnapshot(slug, "Kevin");
  expect(replaced.hash).toBe(sha256(second));
  expect(replaced.active).toBe(true);

  // Turned off, after confirming.
  await page.getByRole("button", { name: l.desactivar }).click();
  const turnOff = page.getByRole("dialog", {
    name: l.confirmarDesactivar.titulo("Kevin"),
  });
  await expect(turnOff).toContainText(l.confirmarDesactivar.cuerpo("Kevin"));
  await checkScreen(page);
  await turnOff.getByRole("button", { name: l.confirmarDesactivar.si }).click();
  await expect(page.getByText(l.desactivado.titulo("Kevin"))).toBeVisible(
    FIRST_VISIT,
  );
  await expect(page.getByText(l.nuevo.titulo)).toHaveCount(0);
  const off = await barberLinkSnapshot(slug, "Kevin");
  expect(off.active).toBe(false);
  expect(off.hash).toBe(sha256(second));
  await expect(page.getByRole("button", { name: l.desactivar })).toHaveCount(0);
  await checkScreen(page);

  await page.goto("/panel/barberos");
  await expect(barberRow(page, "Kevin")).toContainText(
    t.linkDesactivado,
    FIRST_VISIT,
  );

  // Only a new link brings them back.
  await page.goto(`/panel/barberos/${unsent.id}/link`);
  await page.getByRole("button", { name: l.crearNuevo }).click();
  await expect(page.getByText(l.nuevo.titulo)).toBeVisible(FIRST_VISIT);
  const third = await shownToken(page);
  expect([first, second]).not.toContain(third);
  const back = await barberLinkSnapshot(slug, "Kevin");
  expect(back.active).toBe(true);
  expect(back.hash).toBe(sha256(third));
  await checkScreen(page);

  // An inactive barber keeps a link for what they had, and D-56 says so.
  await setBarberActive(slug, "Kevin", false);
  await page.goto(`/panel/barberos/${unsent.id}/link`);
  await expect(page.getByText(l.inactivo.titulo)).toBeVisible(FIRST_VISIT);
  await expect(page.getByText(l.alcanceInactivo("Kevin"))).toBeVisible();
  await expect(page.getByRole("button", { name: l.copiarNuevo })).toBeVisible();
  await checkScreen(page);
});

test("a barber agenda link is never kept, sent on or listed", async ({
  page,
}) => {
  // The page arrives with task 4.4; the headers already cover the path.
  const response = await page.request.get(`/b/${"A".repeat(43)}`);
  const headers = response.headers();
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-robots-tag"]).toBe("noindex");
  expect(headers["cache-control"]).toContain("no-store");
});

test("the owner's barber and other barbershops' barbers have no link screen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { slug } = await signInSetUpOwner(page);
  const owner = await barberLinkSnapshot(slug, "Carlos Pérez");
  const other = await createConfirmedOwner(
    uniqueEmail("link-ajeno"),
    PASSWORD,
    { ownerName: "Otro Dueño", barbershopName: "Barbería Ajena" },
  );
  const stranger = await insertBarber(other.slug, "Ajeno");

  for (const id of [owner.id, stranger, "no-existe"]) {
    await page.goto(`/panel/barberos/${id}/link`);
    await expect(
      page.getByRole("heading", { level: 1, name: textos.noEncontrado.titulo }),
    ).toBeVisible(FIRST_VISIT);
  }
  const after = await barberLinkSnapshot(other.slug, "Ajeno");
  expect(after.issuedAt).toBeNull();

  // D-54 of the owner offers no link screen either.
  await page.goto(`/panel/barberos/${owner.id}`);
  await expect(page.getByText(t.linkDueno)).toBeVisible(FIRST_VISIT);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${t.linkPrivado}`) }),
  ).toHaveCount(0);
});
