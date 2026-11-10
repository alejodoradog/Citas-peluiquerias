# Pruebas de punta a punta (Playwright)

- **Next.js 16 deja montada y oculta la página anterior** cuando la navegación es por `Link`. Por eso:
  - los campos se buscan con `getByRole("textbox", { name })` o `getByRole("combobox", { name })`, no con `getByLabel`, porque los roles ignoran lo oculto;
  - los textos que se repiten entre pantallas llevan `.filter({ visible: true })`.
- **El servidor de desarrollo compila cada página la primera vez que se abre.** En la primera visita se espera hasta 20 s (`toHaveURL(..., { timeout: 20_000 })`). Los flujos largos usan `test.setTimeout(...)`.
- **Las casillas e interruptores son inputs nativos ocultos** (`sr-only`): se marcan con `check({ force: true })` / `uncheck({ force: true })`, o con el teclado.
- **Cada pantalla nueva pasa `expectAccessible`, `expectTouchTargets` y `expectNoZoomOnFocus`** (`tests/e2e/helpers/pantalla.ts`).
- **Los dueños de prueba se crean con `createConfirmedOwner`** (`tests/e2e/helpers/supabase.ts`), sin correo, para no gastar el límite de Auth. El asistente se termina con `finishSetup` (`tests/e2e/helpers/asistente.ts`).
