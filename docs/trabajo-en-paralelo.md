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
| 4.2 Detalle de cita, estados, reprogramar, cita manual, bloqueos (D-34 a D-39) | Fundador | Fusionada (#49) |
| 4.3 Clientes | Fundador | Fusionada (#42) |
| 4.4 Vista "Mi agenda" del barbero (B-01 a B-06) | Socio | Fusionada (#48) |
| 4.5 Agenda en vivo (consultar cada 60 s) | Fundador | Fusionada (#51) |
| **5.4** Panel de plataforma (P-01 a P-06) y migración 9 | **Socio** | Pendiente: **la siguiente** |
| **4.6** Cierre del día (D-64, P2) | **Socio** | Pendiente |
| **5.5** Ciclo de suscripción, migración 10 y avisos en la agenda (D-70 a D-72) | **Socio** | Pendiente (después de la 5.4) |
| **6.3** PWA instalable | **Socio** | Pendiente |
| 5.1 Cola de correos | Fundador | En curso (`hito-5-cola-correos`) |
| 5.2 y 5.3 Envío por el proveedor (decisión 0008, propuesta) y recordatorio | Fundador | Pendiente |
| "Mis citas" del cliente (C-19 a C-21, P2; sale de la 5.5) | Fundador | Pendiente (después de la 5.2) |
| 4.2b Cerrar las rutas viejas de edición de citas para el dueño | Fundador | Fusionada (#54) |
| 6.5 Términos de uso y política de datos personales | Fundador | Pendiente |
| 6.4 y 6.6 Producción y barberías piloto | Fundador | Pendiente (necesita sus cuentas) |
| 6.1 y 6.2 E2E de los 3 flujos y prueba en celulares reales | Los dos | Al final del hito 5 |

**Orden del socio:** **5.4 → 4.6 → 5.5 → 6.3.**
- Si una tarea queda frenada esperando una respuesta del fundador, avanza la siguiente y vuelve después.
- Si terminas todo, pide más al fundador. No tomes una tarea de otra persona sin cambiar el tablero en un PR.

**Por qué este reparto:** cada persona es dueña de un tema completo.
- **El socio tiene suscripciones y plataforma:**
  - `/admin`;
  - la fórmula de fechas y su ciclo (5.4 y 5.5, que usan la misma fórmula);
  - el cierre del día en `/panel/cierre`, una pantalla nueva y aislada;
  - la PWA.
- **El fundador tiene los correos (5.1 a 5.3)**, el camino crítico del hito 5, y las rutas del cliente.
- Los únicos puntos de contacto están en la sección 4, en "Archivos compartidos".

## 2. Qué hay que construir

### 4.4 Vista "Mi agenda" del barbero (fusionada)
Fusionada en #48. Su documento está en `docs/tareas/`. Sirve de modelo para las funciones `security definer` y las pruebas pgTAP de las tareas que siguen.

### 5.4 Panel de plataforma (la siguiente)
- **Spec:** `docs/spec.md`, funciones 20 a 24 (super admin) y "Suscripciones y activación manual".
- **Plan:** tarea 5.4: "lista de barberías, ficha, Registrar pago y activar hasta, anular un pago con rastro, suspender, Reactivar, extender prueba y métricas (P2, P-06)".
- **Migración 9 de la 0006** (`add_subscription_payment_flow`): el SQL exacto está en el anexo A de `docs/decisiones/0006-esquema-base-de-datos-final.md`, y la explicación en la sección "### 9.". No se rediseña.
- **Copia en TypeScript de la fórmula de fechas**, con una prueba que compare las dos (plan 5.4). La fase de suscripción ya existe en SQL: `private.barbershop_phase`, migración `20261111050000_add_public_booking.sql`.
  - Ponla en `src/modulos/suscripciones/dominio/`, porque la 5.5 la reutiliza.
  - Prueba los casos de la spec: el 31 de enero vence el 28 de febrero; pagar antes de vencer o el mismo día empieza al día siguiente del vencimiento; pagar ya vencido cuenta desde el día del pago; anular un pago recalcula.
- **Lo que ya existe:**
  - `/admin` con `requireSuperAdmin` (`src/app/(admin)/admin/page.tsx` y `src/modulos/cuentas/guards.ts`);
  - el usuario de prueba super admin en `barberias-dev`: `admin-prueba@yapoin.com` (pide la contraseña al fundador).
- **Pantallas:** P-01 (barberías), P-02 (ficha), P-03 (registrar pago), P-04 (extender prueba), P-05 (suspender), P-06 (métricas, P2).
- **Ojo, es dinero:** los pagos no se editan ni se borran; anular deja rastro. Pasa `revisor-seguridad` con atención a que solo el super admin llegue a esas funciones.

### 4.6 Cierre del día
- **Spec:** función 17: "Cierre del día: servicios atendidos, total y comisión por barbero" (P2).
- **Diseño:** `docs/diseno/D64-Cierre-dia.dc.html`. Trae:
  - total atendido, servicios atendidos, cuántos no asistieron y cuántos quedan pendientes;
  - una fila por barbero con atendidos, total y comisión;
  - el porcentaje de comisión de los barberos;
  - el botón "Descargar resumen".
- **Ruta:** `/panel/cierre`, una carpeta nueva en `src/app/(panel)/panel/cierre/`. Se llega desde Más (D-50) con una fila nueva: es lo único que tocas en `src/app/(panel)/panel/mas/page.tsx`.
- **Cómo se calcula:**
  - solo las citas `attended` del día en `America/Bogota`, con `src/lib/fechas`;
  - el dinero sale de las líneas de la cita (`appointment_services`), que copian el precio del servicio al crear la cita. Así, un cambio de precio posterior no altera un cierre;
  - pesos enteros. La comisión se redondea al peso, y la regla de redondeo va en el dominio (`src/modulos/cierre/dominio/`) con sus pruebas;
  - el dueño solo ve sus sedes (RLS o una función con `private.member_barbershop_ids()`).
- **Lo que no existe:** la base de datos **no tiene comisión**. D-64 muestra un porcentaje por barbería (40 %), y al dueño que corta ("Yo también corto", `is_owner`) sin comisión ("—").
- **Pregúntale al fundador antes de escribir la migración:**
  1. ¿Un solo porcentaje por sede, como en el diseño, o uno por barbero?
  2. ¿El dueño que corta queda siempre sin comisión?
  3. "Descargar resumen": ¿CSV, PDF o una imagen para compartir?
  4. ¿Se puede ver el cierre de días anteriores, o solo el de hoy?

  Si no responde y hay que seguir, toma lo más conservador del diseño: un porcentaje por sede, el dueño sin comisión, CSV y solo hoy con flechas de día. Márcalo como provisional en `docs/tareas/4.6-cierre-del-dia.md`.

### 5.5 Ciclo de suscripción (después de la 5.4)
- **Spec:** "Ciclo de la suscripción", pasos 2 (avisos), 5 (gracia), 6 (suspensión) y 7 (reactivación), y la fila "Suscripción por vencer, vencida, suspendida, pago registrado" de "Mensajes del MVP".
- **Migración 10 de la 0006** (`read_only_when_suspended`): el SQL está en el anexo A (A.10) y la explicación, con la lista de pruebas, en la sección "### 10.".
  - Ojo con su riesgo: los fixtures con fechas fijas deben pasar a fechas relativas, moviendo `trial_ends_on` junto con `expires_on`. Corre **todo** pgTAP, no solo tus archivos.
- **Avisos en la agenda**, sin pantalla de suscripción:
  - los diseños son `D70-Agenda-por-vencer` (prueba por vencer), `D71-Agenda-gracia` (vencida en gracia) y `D72-Agenda-suspendida` (solo lectura);
  - haz **un componente** `SubscriptionNotice` en tu módulo, que recibe la fase y las fechas;
  - la agenda del fundador (`src/app/(panel)/panel/page.tsx`) lo monta arriba con una sola línea. Avísalo en el PR;
  - los datos de pago (valor, llave Bre-B, Nequi y correo) que el diseño marca entre corchetes no están en el repo. Pídeselos al fundador y ponlos en un solo lugar.
- **Limpieza de cuentas sin confirmar**, que hoy apartan el link de su barbería (decisión `0006-correo-unico-canal.md`, "Links apartados"):
  - la tarea define el plazo: **pregúntalo al fundador**;
  - corre con pg_cron (decisión 0007, punto 8).
- **Correos del ciclo** (por vencer, el día del vencimiento, 3 días después, suspendida y pago registrado) van por la cola de la 5.1, que es del fundador.
  - **Contrato:** la 5.1 deja `private.enqueue_notification(barbershop_id, type, dedupe_key, appointment_id default null, scheduled_for default now(), payload default '{}')`. Devuelve el id, o `null` si esa `dedupe_key` ya estaba: así un aviso no sale dos veces. El destinatario no se pasa, porque los de suscripción van al dueño de la sede (`docs/tareas/5.1-cola-de-correos.md`).
  - Si la 5.1 todavía no está fusionada, construye todo lo demás de la 5.5 y deja los correos para un PR corto después. No crees tu propia cola.
- **No incluye "Mis citas"** (C-19 a C-21): es un link que llega por correo y lo hace el fundador.

### 6.3 PWA instalable
- **Spec:** "Web (las 3 aplicaciones)": instalable como PWA. **Plan:** tarea 6.3: "PWA instalable, ícono, nombre, pantalla sin conexión".
- **Qué lleva:**
  - `src/app/manifest.ts` con el nombre "Yapoin", los colores de `src/app/globals.css` y `start_url` en `/panel`;
  - los íconos;
  - una pantalla sin conexión con sus textos en un bloque propio de `textos.ts`.
- **Sin diseño en el repo:** pídele al fundador el ícono y el texto de la pantalla sin conexión.
- **Un service worker solo si hace falta para la pantalla sin conexión.** Nunca guardes en caché la disponibilidad, la reserva ni la agenda, que van siempre en vivo (plan 3.2). Si necesitas cabeceras en `next.config.ts`, van en su propio PR, avisado, porque es un archivo compartido.

## 3. Diseño, sin acceso a Claude Design

El diseño vive en Claude Design, pero **cada pantalla está copiada en el repo** como HTML estático: `docs/diseno/<ID>-<nombre>.dc.html`. Las de este reparto:

- **5.4:** `P01` a `P06`.
- **4.6:** `D64-Cierre-dia`.
- **5.5:** `D70-Agenda-por-vencer`, `D71-Agenda-gracia` y `D72-Agenda-suspendida`.

Cómo usarlas:

- **Ábrelas en el navegador** (doble clic). Miden 390 px de ancho, el tamaño de celular del diseño.
- **La marca** "Silla" que aparece en algunas es **Yapoin**.
- **Los textos** del diseño son los de la app, en español de Colombia, y van a `src/ui/textos.ts`. Los datos de ejemplo (Kevin, Barbería La Esquina) no.
- **No copies los estilos en línea.** Usa los tokens de `src/app/globals.css` y los componentes de `src/ui/`: botones, chips, avisos, hojas (`sheet.tsx`), estados vacío, cargando y error, avatares e íconos. Si falta un componente, créalo en `src/ui/` con su prueba.
- **Fidelidad:**
  - mide con Playwright en 390 × 844 contra el `.dc.html`, como en `tests/e2e/fidelidad.spec.ts`;
  - usa **un archivo propio** (`tests/e2e/fidelidad-plataforma.spec.ts`, `tests/e2e/fidelidad-cierre.spec.ts`, `tests/e2e/fidelidad-suscripcion.spec.ts`); el proyecto "diseno" de Playwright corre todo `fidelidad*.spec.ts`;
  - las pastillas (`rounded-full`) no se comparan por `border-radius`;
  - el diseño no usa `box-sizing`, así que un elemento de 46 px con borde de 1 px mide 48.
- **Si una pantalla del plan no tiene diseño en `docs/diseno/`**, pídesela al fundador; no la inventes.

## 4. Reglas para no pisarse

### Ramas y PRs (`CLAUDE.md`, "Forma de trabajo")
- Una rama por tarea desde `main` actualizado: `hito-5-plataforma`, `hito-4-cierre-dia`, `hito-5-suscripcion` y `hito-6-pwa`.
- Un PR por tarea, en borrador desde el primer push, y listo con el CI en verde.
- **Antes de abrir el PR y antes de fusionar, mete `main` en tu rama** (merge, no rebase) y vuelve a pasar el CI.
- Solo `alejodoradog` fusiona, con "Create a merge commit". Sin coautoría ni marcas de Claude.

### Migraciones (lo más delicado)
- Créalas con `pnpm supabase migration new <nombre>`, que usa la hora actual. Nunca edites una migración que ya está en `main`.
- **Antes de fusionar**, si en `main` hay una migración con número **mayor** que la tuya, **renombra la tuya** con la hora actual. No ha corrido en ninguna parte, así que es seguro. El workflow "Migrate barberias-dev" usa `supabase db push` sin `--include-all`, y **falla** si llega una migración con número menor que la última aplicada.
- **Pruebas pgTAP:**
  - el socio usa los números **40 a 59**: por ejemplo `45_platform_payments.test.sql`, `48_day_close.test.sql` y `50_read_only_when_suspended.test.sql`;
  - el fundador, del 32 al 39 y del 60 en adelante.
- Toda función nueva expuesta a `anon` o `authenticated` va en la lista de `supabase/tests/database/02_rls.test.sql`, en orden alfabético. Si hay conflicto, quedan **las entradas de los dos**.

### Archivos compartidos
| Archivo | Regla |
| --- | --- |
| `src/ui/textos.ts` | Un bloque propio de primer nivel (`plataforma: { … }`, `cierre: { … }`, `suscripcion: { … }`, `pwa: { … }`), puesto **justo antes de `  proximamente: {`**. No edites bloques ajenos; si necesitas un texto de otro bloque, impórtalo. |
| `src/lib/routes.ts` | Agrega tus rutas en un grupo con un comentario de la tarea. `barberAgenda` (`/b/<token>`) y `admin` ya existen. |
| `src/lib/supabase/database.types.ts` | Se regenera con `pnpm db:types`; el CI lo compara con el generador. Si hay conflicto, regenéralo después de meter `main`. |
| `src/app/(panel)/panel/page.tsx` (la agenda, del fundador) | Solo montar `SubscriptionNotice` (5.5), una línea. Avísalo en el PR. |
| `src/app/(panel)/panel/mas/page.tsx` (Más, D-50, del fundador) | Solo la fila "Cierre del día" (4.6). Avísalo en el PR. |
| `src/ui/icons.tsx` | Los íconos nuevos van al final del archivo. |
| `tests/e2e/helpers/*.ts` | Las funciones nuevas van al final. No cambies la firma de las existentes; si necesitas otra cosa, agrega una función nueva. |
| `playwright.config.ts`, `.github/`, `next.config.ts`, `CLAUDE.md` | No se tocan sin avisar al otro (un PR propio, `docs-` o `ci-`). |
| `docs/plan.md` | Solo la casilla de tu tarea, y solo cuando la verificaste en la URL desplegada. |

### Calidad (la puerta común del hito)
- Prueba antes del código; lint, typecheck, unitarias y pgTAP en verde.
- E2E de los flujos de tu tarea en `tests/e2e/<tema>.spec.ts`, con `expectAccessible`, `expectTouchTargets` y `expectNoZoomOnFocus` (`tests/e2e/helpers/pantalla.ts`). Lee `.claude/rules/pruebas.md`: Next deja montada y oculta la página anterior.
- Revisores `revisor-spec` y `revisor-seguridad` antes de marcar el PR listo. La 5.4, la 4.6 y la 5.5 tocan permisos y dinero.
- Documenta la tarea en `docs/tareas/<n>-<tema>.md` con el formato de `docs/tareas/3.4-gestionar-cita.md`: qué hace, base de datos, decisiones provisionales numeradas y riesgos.
- Agrega las pruebas humanas de tu tarea a `docs/pruebas-humanas-hito-<n>.md`, para que el fundador las haga en `www.yapoin.com`.

### Decisiones de negocio
Si la spec no responde algo, **pregunta al fundador** antes de decidir. Si hay que seguir, toma la opción más conservadora, márcala como provisional en el archivo de la tarea y avísale en el PR.

## 5. Entorno
- **Base de desarrollo:** `barberias-dev`. **Producción no existe todavía**; nunca la toques.
- **La app desplegada:** `https://www.yapoin.com`, que es el proyecto de Vercel `citas-peluiquerias`. Cada fusión a `main` despliega, y el workflow "Migrate barberias-dev" aplica las migraciones.
- **Local:** Docker para `pnpm supabase start`, y `pnpm test:e2e` con su Supabase local. El CI corre todo igual.
- **El repo es público:**
  - nunca subas llaves, contraseñas ni datos de personas reales (`docs/operacion/repo-publico.md`);
  - nunca leas ni escribas `.env*`;
  - Turnstile y Supabase usan sus llaves de prueba en local y en el CI (`scripts/ci/supabase-env.mjs`).
