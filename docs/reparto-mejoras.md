# Reparto de las mejoras de la fase 7
Para el socio (`alejodoradog`) y su Claude Code. Dice qué tareas de la revisión del 15 de noviembre de 2026 hace cada persona y cómo no pisarse.

- **El plan completo,** con el detalle de cada tarea y las decisiones que faltan: `docs/mejoras-revision-2026-11-15.md`. Léelo antes de empezar una tarea.
- **Las reglas de siempre** siguen igual: `CLAUDE.md` y `docs/trabajo-en-paralelo.md` (ramas, PR, migraciones, calidad). Aquí solo está lo propio de esta fase.

## 1. Quién hace qué

### El socio

| Orden | Tarea | Rama | Puedes empezar |
| --- | --- | --- | --- |
| 1 | 7.10 Servicios tocables en la página pública | `hito-7-servicios-tocables` | Ya |
| 2 | 7.12 Panel de plataforma para computador, con métricas | `hito-7-admin-escritorio` | Ya la distribución; las métricas, con D10 |
| 3 | 7.8 Prueba de 30 días y planes | `hito-7-planes` | Los 30 días, los precios tachados, el límite de profesionales y "Cambiar plan", cuando se fusione la 7.1. El plan elegido en el registro, con la 7.2 fusionada. El plan 2 sin prueba, con lo que falta de D3 |
| 4 | 7.9 Afiche y logo | `hito-7-afiche` | El afiche, cuando se fusione la 7.1. El logo, con D1 |
| 5 | 7.11 Intervalo de reserva configurable | `hito-7-intervalo` | Con D8 |

### El fundador

| Orden | Tarea | Rama |
| --- | --- | --- |
| 1 | 7.1 Lenguaje neutral en toda la plataforma | `hito-7-lenguaje` |
| 2 | 7.2 Registro: tipo de establecimiento y textos legales | `hito-7-registro` |
| 3 | 7.3 Asistente: servicios genéricos, formulario vacío, ubicación obligatoria | `hito-7-asistente` |
| 4 | 7.4 Bloqueos del profesional | `hito-7-bloqueos` |
| 5 | 7.5 Aviso de reserva al profesional, con WhatsApp | `hito-7-aviso-profesional` |
| 6 | 7.6 Cuentas de profesional por invitación | `hito-7-cuentas-profesional` |
| 7 | 7.7 Cita inmediata | `hito-7-cita-inmediata` |

### Por qué este reparto
Cada persona se queda con temas completos, y casi todos son los que ya conoce.

- **El socio tiene el dinero, la plataforma y la entrada:**
  - las suscripciones y la fórmula de fechas son suyas (5.4 y 5.5), y la prueba de 30 días y los planes las cambian;
  - la landing es suya (#87), y ahí viven los precios;
  - `/admin` es suyo;
  - recibe además dos cosas de la reserva del cliente (7.10 y 7.11) y el afiche (7.9), para repartir la carga. Son tareas aisladas, con pocos archivos.
- **El fundador tiene el lenguaje, el registro y todo lo del profesional:**
  - el barrido de textos toca toda la aplicación y tiene que hacerlo una sola persona;
  - el registro y el asistente son suyos (fase 2);
  - las cuentas de profesional son lo más delicado en seguridad, y arrastran los bloqueos, el aviso por correo y la cita inmediata. Por eso en esta fase **la vista del profesional pasa al fundador**, aunque la construyó el socio en la 4.4.

## 2. Dónde se pueden pisar

| Archivo o zona | Regla en la fase 7 |
| --- | --- |
| `src/ui/textos.ts` | **Hasta que se fusione la 7.1, no edites textos fuera de tu bloque.** El fundador avisa cuando se fusione; ahí metes `main` en tu rama. Después vuelve la regla de siempre: un bloque propio por tarea. Los textos nuevos ya nacen con "establecimiento" y "profesional". |
| El registro (`registration-form.tsx`) y la función que crea la cuenta | Los cambia la 7.2 (tipo) y después la 7.8 (plan). **La parte de registro de la 7.8 empieza con la 7.2 ya en `main`.** Una migración que vuelve a crear esa función tiene que partir de la versión de `main`, o borra el cambio del otro. |
| `/b/[token]`, las funciones del profesional y Más › Barberos | Del fundador en esta fase (7.4 a 7.7). |
| `src/app/(panel)/panel/configurar/listo/` (pantalla final) | Del socio (7.8 y 7.9). El barrido de la 7.1 le cambia textos antes. |
| `src/app/(panel)/panel/compartir/` | El afiche es del socio (7.9). La lista de profesionales es del fundador y va en la 7.6, después. |
| `src/app/[slug]/page.tsx` (página pública) | Del socio (7.10). |
| El motor de disponibilidad (`src/modulos/agenda/dominio/availability.ts`) y `/panel/reservas` | Del socio (7.11). La cita inmediata del fundador (7.7) no usa la cuadrícula. |
| `src/app/_landing/` y `/admin` | Del socio. |
| Los correos (`supabase/functions/send-notifications/`) | Las plantillas de citas son del fundador (7.5). Si la 7.8 cambia un aviso de suscripción, es del socio. |
| La tabla `barbershops` | Cada tarea suma su columna en su propia migración: el tipo (7.2), la ubicación obligatoria (7.3), el plan elegido (7.8) y el intervalo (7.11). `database.types.ts` se regenera después de meter `main`. |
| Pruebas pgTAP | El socio usa los números **80 a 99**; el fundador, del **65 al 79**. Los rangos anteriores están casi llenos. |
| `docs/spec.md` | Cada tarea actualiza su parte de la spec en su propio PR: el lenguaje (7.1), la prueba y los planes (7.8), el intervalo (7.11), las cuentas (7.6). |

## 3. Lo que necesitas del fundador antes de cada tarea
Las decisiones están en la sección 3 del plan, con una recomendación en cada una. Si una no ha llegado y hay que seguir, toma la recomendación, márcala como provisional en la ficha de la tarea y avísalo en el PR.

| Tarea | Decisión |
| --- | --- |
| 7.8 | **D3:** ya está decidido que el plan limita los profesionales y que el cambio de plan lo acepta el admin. Falta si el plan 2 recibe citas antes de pagar, cuánto paga desde el segundo mes y desde cuándo se cobra un cambio de plan. Es dinero: no lo tomes como provisional. |
| 7.9 | **D1:** el archivo del logo oficial. El nombre ya está decidido: Yapoin. |
| 7.11 | **D8:** el intervalo por defecto, desde dónde se cuentan las horas y si aplica al dueño. |
| 7.12 | **D10:** las métricas que van primero, y el permiso para diseñar el escritorio sin diseño previo. |

## 4. Notas de cada tarea del socio

### 7.10 Servicios tocables
- La reserva ya recibe el servicio en la dirección: `/<slug>/reservar?servicios=<id>` (`src/modulos/agenda/dominio/booking-flow.ts`). No hay que tocar la reserva.
- El toque ya muestra respuesta inmediata en toda la aplicación (`src/ui/tap-feedback.tsx`): no agregues otro indicador.
- La página pública sale de una caché corta. La fila enlaza por el `id` del servicio que ya viene en el perfil.

### 7.12 Panel de plataforma para computador
- Las tres pantallas usan `max-w-md`: `admin/page.tsx`, `admin/barberias/[id]/page.tsx` y `admin/metricas/page.tsx`.
- Los totales se calculan en la base, con funciones solo para el super admin. No traigas todas las citas al navegador.
- La métrica "por tipo de establecimiento" espera la columna de la 7.2. Lo demás no.
- Sin servicios nuevos (decisión 0007). Si quieres una librería de gráficos, avísala en el PR: que cargue solo en `/admin`.
- Las pantallas de escritorio no tienen diseño en `docs/diseno/`: espera D10.

### 7.8 Prueba de 30 días y planes
- Los 20 días están en tres lugares que deben coincidir, y una prueba los compara:
  - `TRIAL_DAYS` en `src/modulos/suscripciones/dominio/trial.ts`;
  - `private.new_trial_expires_on()`, en la migración `20261109035950_add_create_barbershop.sql`;
  - la función del registro.
- Se cambian con una migración nueva. Nunca se edita una migración que ya está en `main`.
- Los términos de uso dicen "20 días" escrito a mano (`src/ui/textos.ts`, bloque legal, del fundador). Cámbialo en tu PR y avísalo: los términos cambian de fecha de actualización.
- El WhatsApp de Yapoin ya está en `src/app/_landing/landing-nav.tsx`.
- "Recibe citas cuando se registra su primer pago" ya existe para las sedes creadas con la prueba vencida (spec, "Ciclo de la suscripción", paso 1). Úsalo para el plan 2, no crees otro estado.
- El precio por número de profesionales (5.6) no se rediseña: lee `docs/tareas/5.6-precio-por-barberos.md`. Lo que sí cambia es su decisión provisional 1: ahora el plan limita cuántos profesionales se pueden crear.
- **El límite** (decisión del fundador, 2026-11-15): el plan 1 permite hasta 4 profesionales activos, contando al dueño si también atiende. El catálogo `plans` ya trae `max_barbers`. La regla va en la base, en las funciones que crean o reactivan un profesional y en la que termina el asistente.
- **"Cambiar plan"** es una solicitud que el super admin acepta o rechaza en `/admin`. Mientras esté pendiente, el límite sigue siendo el del plan actual. La pantalla del dueño va en Más, junto a los datos del establecimiento (Más es del fundador: una fila nueva, avísalo en el PR).
- Pasa `revisor-seguridad`.

### 7.9 Afiche y logo
- El afiche que se descarga se arma en `src/ui/poster-download-button.tsx`. La vista previa debe salir del mismo lugar, para que lo que se ve sea lo que se imprime.
- La marca está en `src/ui/brand.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/favicon.ico`, `public/icon-192.png`, `public/icon-512.png`, la landing, el afiche y el encabezado de los correos (`supabase/functions/send-notifications/render.ts`).

### 7.11 Intervalo de reserva
- El paso está en `SLOT_STEP_MINUTES` (`availability.ts`). El motor es puro y tiene pruebas: amplíalas primero.
- Hay otras dos constantes de 15 minutos, `QUARTER_MS` en `owner-slots.ts` y en `barber-agenda.ts`. Son de la cita manual del dueño y de los bloqueos: no cambian (D8).
- La base debe rechazar una reserva pública en una hora fuera de la cuadrícula. Sin eso, cualquiera se salta el intervalo con una petición armada a mano.
- Al guardar el intervalo hay que refrescar el perfil público en caché, como hacen las demás opciones de `/panel/reservas`.

## 5. Cómo se cierra la fase
- Cada tarea, como siempre: su ficha en `docs/tareas/7.N-<tema>.md`, lint, typecheck, pruebas, `revisor-spec` y `revisor-seguridad` cuando toque datos, permisos o dinero.
- El tablero de `docs/trabajo-en-paralelo.md` se actualiza en el mismo PR que toma o termina una tarea.
- Las pruebas humanas de la fase van en `docs/pruebas-humanas-hito-7.md` y se hacen juntas al final.
