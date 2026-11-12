# Trabajo en paralelo

Dos personas construyen Yapoin al mismo tiempo, cada una con su propio Claude Code:

- **Fundador** (`manuel-alejandro429`)
- **Socio** (`alejodoradog`)

Este documento dice quién hace qué y las reglas para no pisarse. Lo lee cualquier herramienta de IA **antes de empezar una tarea**. Manda junto con `CLAUDE.md`; si chocan, manda `CLAUDE.md`.

## 1. Quién hace qué (tablero)

Se actualiza en el mismo PR que toma o termina una tarea: cambia "Pendiente" por "En curso (rama)" y luego por "Fusionada (#PR)".

| Tarea (docs/plan.md) | Dueño | Estado |
| --- | --- | --- |
| 4.1 Agenda del dueño | Fundador | Fusionada (#43) |
| 4.3 Clientes | Fundador | Fusionada (#42) |
| **4.2** Detalle de cita, estados, reprogramar, cita manual, bloqueos (D-34 a D-39) | Fundador | Pendiente |
| **4.4** Vista "Mi agenda" del barbero (B-01 a B-06) | **Socio** | En curso (`hito-4-barbero`) |
| **4.5** Agenda en vivo (consultar cada 30–60 s) | Fundador | Pendiente |
| **4.6** Cierre del día (D-64, P2) | Fundador | Pendiente |
| **5.1, 5.2 y 5.3** Cola de correos, SES y recordatorio | Fundador | Pendiente |
| **5.4** Panel de plataforma (P-01 a P-06) y migración 9 | **Socio** | Pendiente |
| **5.5** Ciclo de suscripción (D-70 a D-72) y migración 10 | Fundador | Pendiente (va después de la 5.4) |
| Hito 6 | Se reparte al llegar | Pendiente |

**Orden del socio:** primero la **4.4** y después la **5.4**. Si termina antes, pide la siguiente al fundador; no tomes una tarea de otra persona sin cambiar el tablero en un PR.

**Por qué este reparto:** la 4.4 vive en `/b/<token>` y la 5.4 en `/admin`, rutas que nadie más toca. Lo del fundador vive en `/panel` y en los correos.

## 2. Qué hay que construir

### 4.4 Vista "Mi agenda" del barbero
- **Spec:** `docs/spec.md`, "Link privado del barbero".
- **Plan:** puerta del hito 4: "El barbero ve solo su agenda, sin precios totales ni otros barberos, y un link desactivado da B-05".
- **Contrato:** `docs/decisiones/0006-esquema-base-de-datos-final.md`, "Contrato de las funciones de reserva y de link", punto "Mi agenda del barbero (4.4)":
  - funciones `security definer` que reciben el **hash** del token y hacen `perform set_config('yapoin.actor', 'barber', true)`;
  - aceptan el link si `link_active`, **aunque el barbero esté inactivo**;
  - dejan pasar a `attended` o `no_show` (también con la barbería suspendida) y cancelar (`cancelled_by_barbershop`, solo en fase `active`);
  - crear bloqueos solo si el barbero está activo.
- **Lo que ya existe:**
  - el token y su hash: `src/lib/tokens/link-token.ts` y `barbers.link_token_hash`, tarea 2.3;
  - la página "Muy pronto" en `src/app/b/[token]/page.tsx`, que se reemplaza;
  - las cabeceras de link privado para `/b/` en `next.config.ts`;
  - la agenda del dueño, como referencia de lógica (no de permisos): `src/modulos/agenda/dominio/owner-agenda.ts`;
  - el modelo de un link privado de cliente: tarea 3.4, `docs/tareas/3.4-gestionar-cita.md`, `src/app/c/[token]/` y la migración `20261112010000_add_manage_appointment.sql`.
- **Pantallas:** B-01 (hoy), B-02 (semana), B-03 (detalle), B-04 (bloquear horas), B-05 (link desactivado), B-06 (barbería suspendida, solo lectura).
- **Ojo:** el diseño B-03 trae una "Nota de diseño". El barbero ve nombre, servicios y hora; no ve precios, totales, datos de contacto del cliente ni a los demás barberos. Esa regla también la debe cumplir la base de datos, no solo la pantalla.

### 5.4 Panel de plataforma
- **Spec:** `docs/spec.md`, funciones 21 y 22 (super admin).
- **Plan:** tarea 5.4: "lista de barberías, ficha, Registrar pago y activar hasta, anular un pago con rastro, suspender, Reactivar, extender prueba y métricas (P2, P-06)".
- **Migración 9 de la 0006** (`add_subscription_payment_flow`): el SQL exacto está en el anexo A de `docs/decisiones/0006-esquema-base-de-datos-final.md`, y la explicación en la sección "### 9.". No se rediseña.
- **Copia en TypeScript de la fórmula de fechas**, con una prueba que compare las dos (plan 5.4). La fase de suscripción ya existe en SQL: `private.barbershop_phase`, migración `20261111050000_add_public_booking.sql`.
- **Lo que ya existe:**
  - `/admin` con `requireSuperAdmin` (`src/app/(admin)/admin/page.tsx` y `src/modulos/cuentas/guards.ts`);
  - el usuario de prueba super admin en `barberias-dev`: `admin-prueba@yapoin.com` (pide la contraseña al fundador).
- **Pantallas:** P-01 (barberías), P-02 (ficha), P-03 (registrar pago), P-04 (extender prueba), P-05 (suspender), P-06 (métricas, P2).

## 3. Diseño, sin acceso a Claude Design

El diseño vive en Claude Design, pero **cada pantalla está copiada en el repo** como HTML estático: `docs/diseno/<ID>-<nombre>.dc.html`. Las de este reparto:

- **4.4:** `B01` a `B06` y `E07-Link-barbero` (el correo con el link, que se envía en la fase 5).
- **5.4:** `P01` a `P06` y `D72-Agenda-suspendida` (lo que ve el dueño suspendido).

Cómo usarlas:

- **Ábrelas en el navegador** (doble clic). Miden 390 px de ancho, el tamaño de celular del diseño.
- **La marca** "Silla" que aparece en algunas es **Yapoin**.
- **Los textos** del diseño son los de la app, en español de Colombia, y van a `src/ui/textos.ts`. Los datos de ejemplo (Kevin, Barbería La Esquina) no.
- **No copies los estilos en línea.** Usa los tokens de `src/app/globals.css` y los componentes de `src/ui/`: botones, chips, avisos, hojas (`sheet.tsx`), estados vacío, cargando y error, avatares e íconos. Si falta un componente, créalo en `src/ui/` con su prueba.
- **Fidelidad:**
  - mide con Playwright en 390 × 844 contra el `.dc.html`, como en `tests/e2e/fidelidad.spec.ts`;
  - usa **un archivo propio** (`tests/e2e/fidelidad-barbero.spec.ts`, `tests/e2e/fidelidad-plataforma.spec.ts`); el proyecto "diseno" de Playwright corre todo `fidelidad*.spec.ts`;
  - las pastillas (`rounded-full`) no se comparan por `border-radius`;
  - el diseño no usa `box-sizing`, así que un elemento de 46 px con borde de 1 px mide 48.
- **Si una pantalla del plan no tiene diseño en `docs/diseno/`**, pídesela al fundador; no la inventes.

## 4. Reglas para no pisarse

### Ramas y PRs (`CLAUDE.md`, "Forma de trabajo")
- Una rama por tarea desde `main` actualizado: `hito-4-barbero`, `hito-5-plataforma`. Un PR por tarea, en borrador desde el primer push, y listo con el CI en verde.
- **Antes de abrir el PR y antes de fusionar, mete `main` en tu rama** (merge, no rebase) y vuelve a pasar el CI.
- Solo `alejodoradog` fusiona, con "Create a merge commit". Sin coautoría ni marcas de Claude.

### Migraciones (lo más delicado)
- Créalas con `pnpm supabase migration new <nombre>`, que usa la hora actual. Nunca edites una migración que ya está en `main`.
- **Antes de fusionar**, si en `main` hay una migración con número **mayor** que la tuya, **renombra la tuya** con la hora actual. No ha corrido en ninguna parte, así que es seguro. El workflow "Migrate barberias-dev" usa `supabase db push` sin `--include-all`, y **falla** si llega una migración con número menor que la última aplicada.
- **Pruebas pgTAP:** el socio usa los números **40 a 59** (`40_barber_agenda.test.sql`, `45_platform_payments.test.sql`); el fundador, el 32 al 39 y del 60 en adelante.
- Toda función nueva expuesta a `anon` o `authenticated` va en la lista de `supabase/tests/database/02_rls.test.sql`, en orden alfabético. Si hay conflicto, quedan **las entradas de los dos**.

### Archivos compartidos
| Archivo | Regla |
| --- | --- |
| `src/ui/textos.ts` | Un bloque propio de primer nivel (`barbero: { … }` y `plataforma: { … }`), puesto **justo antes de `  proximamente: {`**. No edites bloques ajenos; si necesitas un texto de otro bloque, impórtalo. |
| `src/lib/routes.ts` | Agrega tus rutas en un grupo con un comentario de la tarea. `barberAgenda` (`/b/<token>`) y `admin` ya existen. |
| `src/lib/supabase/database.types.ts` | Se regenera con `pnpm db:types`; el CI lo compara con el generador. Si hay conflicto, regenéralo después de meter `main`. |
| `src/ui/icons.tsx` | Los íconos nuevos van al final del archivo. |
| `tests/e2e/helpers/*.ts` | Las funciones nuevas van al final. No cambies la firma de las existentes; si necesitas otra cosa, agrega una función nueva. |
| `playwright.config.ts`, `.github/`, `next.config.ts`, `CLAUDE.md` | No se tocan sin avisar al otro (un PR propio, `docs-` o `ci-`). |
| `docs/plan.md` | Solo la casilla de tu tarea, y solo cuando la verificaste en la URL desplegada. |

### Calidad (la puerta común del hito)
- Prueba antes del código; lint, typecheck, unitarias y pgTAP en verde.
- E2E de los flujos de tu tarea en `tests/e2e/<tema>.spec.ts`, con `expectAccessible`, `expectTouchTargets` y `expectNoZoomOnFocus` (`tests/e2e/helpers/pantalla.ts`). Lee `.claude/rules/pruebas.md`: Next deja montada y oculta la página anterior.
- Revisores `revisor-spec` y `revisor-seguridad` antes de marcar el PR listo. La 4.4 y la 5.4 tocan permisos, links y dinero.
- Documenta la tarea en `docs/tareas/<n>-<tema>.md` con el formato de `docs/tareas/3.4-gestionar-cita.md`: qué hace, base de datos, decisiones provisionales numeradas y riesgos.

### Decisiones de negocio
Si la spec no responde algo, **pregunta al fundador** antes de decidir. Si hay que seguir, toma la opción más conservadora, márcala como provisional en el archivo de la tarea y avísale en el PR.

## 5. Entorno
- **Base de desarrollo:** `barberias-dev`. **Producción no existe todavía**; nunca la toques.
- **La app desplegada:** `https://www.yapoin.com`, que es el proyecto de Vercel `citas-peluiquerias`. Cada fusión a `main` despliega, y el workflow "Migrate barberias-dev" aplica las migraciones.
- **Local:** Docker para `pnpm supabase start`, y `pnpm test:e2e` con su Supabase local. El CI corre todo igual.
- Nunca leas ni escribas `.env*`. Turnstile y Supabase usan sus llaves de prueba en local y en el CI (`scripts/ci/supabase-env.mjs`).
