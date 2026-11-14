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
| 5.4 Panel de plataforma (P-01 a P-06) y migración 9 | Socio | Fusionada (#53) |
| 4.6 Cierre del día (D-64, P2) | Socio | Fusionada (#57) |
| **5.5** Ciclo de suscripción, migración 10 y avisos en la agenda (D-70 a D-72) | **Socio** | Pendiente (después de la 5.4) |
| **6.3** PWA instalable | Socio | Fuera por ahora: el socio decidió no hacer una app (2026-11-13). Falta que el fundador lo confirme |
| 5.1 Cola de correos | Fundador | Fusionada (#56) |
| **5.2** Envío con Resend: el `Sender`, las plantillas, los rebotes y el SMTP de Auth (decisión 0008) | **Socio** (antes del fundador) | En curso (`hito-5-correos`) |
| 5.3 Correos de las citas y recordatorio | Fundador | Pendiente (después de la 5.2) |
| "Mis citas" del cliente (C-19 a C-21, P2; sale de la 5.5) | Fundador | Pendiente (después de la 5.2) |
| 4.2b Cerrar las rutas viejas de edición de citas para el dueño | Fundador | Fusionada (#54) |
| 6.5 Términos de uso y política de datos personales | Fundador | Pendiente |
| 6.4 y 6.6 Producción y barberías piloto | Fundador | Pendiente (necesita sus cuentas) |
| 6.1 y 6.2 E2E de los 3 flujos y prueba en celulares reales | Los dos | Al final del hito 5 |

**Orden del socio:** **5.4 → 4.6 → 5.2 → 5.5** (la 6.3 queda fuera por ahora, ver el tablero).
- La 5.2 va antes de la 5.5 porque es el camino crítico: la 5.3 del fundador y los correos de la 5.5 la necesitan.
- Si una tarea queda frenada esperando una respuesta del fundador, avanza la siguiente y vuelve después.
- Si terminas todo, pide más al fundador. No tomes una tarea de otra persona sin cambiar el tablero en un PR.

**Por qué este reparto:** cada persona es dueña de un tema completo.
- **El socio tiene suscripciones y plataforma:**
  - `/admin`;
  - la fórmula de fechas y su ciclo (5.4 y 5.5, que usan la misma fórmula);
  - el cierre del día en `/panel/cierre`, una pantalla nueva y aislada;
  - la PWA;
  - el envío con Resend (5.2), sobre la cola que dejó la 5.1.
- **El fundador tiene la cola (5.1, fusionada) y lo que se encola por las citas (5.3)**, y las rutas del cliente.
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

### 5.2 Envío con Resend (después de la 4.6)
La 5.1 dejó la cola completa: guarda los correos, los toma cada minuto sin duplicados, los reintenta y los purga. Lo único que falta es **quién envía**. La 5.2 conecta Resend en ese hueco, sin tocar la cola.

**Lee primero, en este orden:**
1. `docs/tareas/5.1-cola-de-correos.md`: cómo funciona la cola, cómo se activa y las decisiones Q1 a Q5. **Q4 y Q5 son reglas para ti.**
2. `docs/decisiones/0008-correo-con-resend.md`: el proveedor, la región, el plan, Auth, el dominio y los rebotes. **El fundador la aceptó el 2026-11-14: el proveedor es Resend.** `CLAUDE.md`, la spec, el plan y la 0007 ya lo dicen.
3. `docs/decisiones/0007-infraestructura.md`: los puntos 6 a 8, "Correo con SES" (el mismo diseño, ahora con Resend) y la tabla de secretos.
4. `docs/spec.md`, "Mensajes del MVP": qué correo va a quién y cuándo.
5. El código de la 5.1:
   - `supabase/functions/send-notifications/run-queue.ts`: la lógica y la interfaz `Sender`;
   - `supabase/functions/send-notifications/index.ts`: la entrada de Deno, con `senderFromEnv()`, que hoy devuelve `null`;
   - `supabase/migrations/20261114023807_add_notification_queue.sql`: la cola, `claim_notifications`, `finish_notification` y `private.notification_recipient`;
   - `supabase/tests/database/34_notification_queue.test.sql`.

**Cómo funciona hoy, de punta a punta:**

```
algo que merece correo ─► private.enqueue_notification(...)   una sola vez por dedupe_key
                                    │
pg_cron, cada minuto ─► private.request_notification_send()   solo si hay algo pendiente
                                    │ pg_net, con la URL y el secreto de Vault
                                    ▼
Edge Function send-notifications ─► responde 202 y sigue en segundo plano
   claim_notifications(50)          préstamo de 5 min, el destinatario se calcula aquí
   Sender.send(mensaje)             ◄── esto es la 5.2
   finish_notification(id, préstamo, sent | retry | cancelled, código)
```

- **El destinatario** llega resuelto en `message.recipient`. Si es `null` (cliente borrado, barbero sin avisos), la cola cancela el correo sin llamar al `Sender`.
- **Los reintentos** los decide la base: 3 intentos, con 5, 10 y 15 minutos de espera. Tu `Sender` solo dice si el fallo es pasajero o permanente.
- **La corrida deja de enviar al minuto 4**, antes de que venza el préstamo.
- **Sin `Sender`, la función responde 503** y no toma nada, así que los correos esperan en la cola. Eso pasa hoy en `barberias-dev` y siempre en local y en el CI.

**Qué construyes:**
1. **`ResendSender`**, en un archivo nuevo, `supabase/functions/send-notifications/resend-sender.ts`:
   - **Sin imports**, como `run-queue.ts`, para que lo usen Deno y Vitest. Recibe `fetch`, la llave y el remitente por parámetro, y así las pruebas le pasan un `fetch` falso.
   - **Una llamada por correo** a `POST https://api.resend.com/emails`. La interfaz `Sender` envía de a uno, y con el piloto (unos 800 correos al día) sobra. El envío por lotes del punto 4 de la 0008 queda para cuando el volumen lo pida. Anótalo como decisión provisional.
   - **Llave de idempotencia = el `id` del correo** de la cola, en la cabecera `Idempotency-Key`. Es la regla Q4: si un reporte no llega a la base, el correo vuelve a la cola y Resend no lo manda dos veces. Confirma en la documentación de Resend la cabecera y cuánto dura la llave (los reintentos de la cola caben en 30 minutos).
   - **El resultado.** Devuelve `{ ok: true }`, o `{ ok: false, permanent, code }`:
     - 429, 5xx y fallos de red son pasajeros (`permanent: false`);
     - una dirección inválida es permanente;
     - una llave mala o un dominio sin verificar no son culpa de la dirección: trátalos como pasajeros, para que el correo no se pierda mientras se arregla la configuración.
   - **`code` es corto**, como `http_429`, `http_422` o `invalid_to`. **Nunca el texto de Resend**, que puede traer la dirección.
   - **Límite de llamadas:** Resend tiene un límite por segundo por equipo, el mismo en todos los planes. Confirma el valor actual y, si hace falta, espera entre envíos. Un 429 ya se reintenta solo.
2. **`senderFromEnv()`** en `index.ts`: devuelve el `ResendSender` cuando están `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo `Yapoin <citas@yapoin.com>`), y `null` si falta alguna. Así la función sigue respondiendo 503 en local, en el CI y en cualquier proyecto sin llave.
3. **Las plantillas en español:**
   - **El contenido se lee al enviar, no al encolar** (regla Q5): el `payload` no lleva datos personales ni secretos.
     - Para armar el correo, la función lee con su cliente de servicio la barbería, la cita, el barbero o lo que el tipo necesite, siempre filtrando por el `barbershop_id` del mensaje.
     - Separa la lectura de datos (en `index.ts` o en un archivo propio) del armado (`render`, puro y con pruebas, que recibe los datos y devuelve asunto, HTML y texto plano).
   - **En la 5.2:** la base común (encabezado con la marca, pie, versión de texto plano) y las plantillas de **suscripción**:
     - `subscription_expiring`, `subscription_expired`, `subscription_suspended` y `subscription_payment_registered`;
     - son de tu dominio, y la 5.5 solo las encola.
   - **Las de citas** (`appointment_*`, `barber_*`) las hace el fundador en la 5.3, sobre tu base. El recordatorio necesita los links Confirmo / Cancelar, y cómo viajan esos links sin guardarlos en el `payload` es una decisión de la 5.3.
   - **Diseño:** E-01 a E-06 no están en el repo; pídeselos al fundador. Solo está `docs/diseno/E07-Link-barbero.dc.html`.
   - **Los textos:** si el empaquetado de la Edge Function no deja importar `src/ui/textos.ts`, van en un archivo de textos propio de la función. Anótalo como excepción en la tarea.
4. **Rebotes y quejas:**
   - una Edge Function nueva, `resend-webhook`, con `verify_jwt = false` en `supabase/config.toml` (una sección nueva al final; avísalo en el PR);
   - **verifica la firma del webhook** (Resend firma con Svix: cabeceras `svix-id`, `svix-timestamp` y `svix-signature`), con su secreto en `RESEND_WEBHOOK_SECRET`. Sin firma válida, 401 y nada más;
   - para saber a qué correo de la cola corresponde un evento, envía el `id` del correo como etiqueta (`tags`) de Resend y léelo en el evento.
   - **Resend ya deja de enviar** a las direcciones que rebotan para siempre. **Pregúntale al fundador** si basta con eso y con guardar el código en el correo de la cola, o si quiere una lista propia de supresión.
     - Una lista propia guarda correos de personas sin `barbershop_id`, así que choca con la regla de `CLAUDE.md` ("toda tabla de negocio tiene `barbershop_id`") y con el borrado de clientes de la 4.3 (Ley 1581).
     - Si se hace, guarda el hash del correo, no el correo, y que `private.notification_recipient` devuelva `null` para esas direcciones. Eso es una migración nueva tuya, nunca un cambio a la de la 5.1.
5. **Desactiva el rastreo de aperturas y de clics** en el dominio de Resend. El rastreo de clics reescribe los links, y los de gestionar la cita llevan un token privado.
6. **Auth por el SMTP de Resend** (punto 5 de la 0008):
   - actualiza `docs/operacion/configurar-barberias-dev.md`: la sección de SMTP, que hoy habla de SES, y las plantillas de `supabase/templates/`, que esperaban a la 5.2;
   - sube el límite de envíos de Auth, que con SMTP propio arranca en 30 por hora;
   - la configuración la hace el fundador en el Dashboard.
7. **El link privado del barbero por correo** (spec, "Mensajes del MVP"; la 2.3 lo dejó para la 5.2, diseño E07):
   - no hay tipo en `notification_type` para ese correo;
   - el link lleva un token, y por Q5 no puede ir en el `payload`.
   - **Consúltalo con el fundador** antes de hacerlo. Lo natural es un PR corto después del envío real, porque toca la pantalla de barberos (del fundador).

**Lo que hace el fundador, y cuándo pedírselo:**
- **Antes de probar de verdad:**
  - crear la cuenta de Resend;
  - agregar `yapoin.com` en `us-east-1`;
  - poner los registros SPF, DKIM y DMARC en Cloudflare, en modo "DNS only".
- **Para activar la cola en `barberias-dev`:**
  - desplegar las funciones;
  - poner los secretos `NOTIFICATIONS_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` y `RESEND_WEBHOOK_SECRET`, y los dos de Vault;
  - los pasos están en `docs/tareas/5.1-cola-de-correos.md`.
  - **Las llaves nunca van al repo ni a un PR** (el repo es público).
- **Puedes construir y probar todo antes de tener la cuenta.** El `Sender`, el `render` y el webhook se prueban con `fetch` y firmas falsas. El CI **nunca** llama a Resend.

**Pruebas:**
- **Unitarias** (Vitest, junto a cada archivo: el proyecto `unit` ya incluye `supabase/functions/**/*.test.ts`):
  - cada respuesta de Resend da el resultado y el código correctos;
  - la cabecera de idempotencia es el `id`;
  - ningún código trae la dirección;
  - el `render` de cada plantilla;
  - el webhook rechaza firmas malas o viejas.
- **pgTAP:** solo si hay migración (números 40 a 59).
- **La prueba real**, en `docs/pruebas-humanas-hito-5.md`:
  1. encolar un correo de suscripción en `barberias-dev` desde el SQL Editor con `private.enqueue_notification`, para una barbería de prueba;
  2. ver que llega a Gmail y a Outlook en la bandeja de entrada, no en spam;
  3. ver en la cola que quedó `sent`.

  Es la mitad del criterio de cierre del hito 5.
- **`revisor-seguridad`** antes de marcar el PR listo: la llave, la firma del webhook, que no se registren correos en los logs y que el contenido de un correo solo lea datos de su barbería.

**Archivos:**
- **Tuyos en la 5.2:**
  - `supabase/functions/send-notifications/` (nuevos archivos y `senderFromEnv` en `index.ts`);
  - `supabase/functions/resend-webhook/`;
  - `docs/tareas/5.2-envio-resend.md`.
- **`run-queue.ts` es la frontera con la cola:** si necesitas cambiar `Sender`, `Queue` o `runQueue`, mantén sus pruebas en verde y avísalo en el PR.

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
- **Correos del ciclo** (por vencer, el día del vencimiento, 3 días después, suspendida y pago registrado) van por la cola de la 5.1 (fusionada en #56), con las plantillas que hiciste en la 5.2.
  - **Contrato:** la 5.1 deja `private.enqueue_notification(barbershop_id, type, dedupe_key, appointment_id default null, scheduled_for default now(), payload default '{}')`. Devuelve el id, o `null` si esa `dedupe_key` ya estaba: así un aviso no sale dos veces. El destinatario no se pasa, porque los de suscripción van al dueño de la sede (`docs/tareas/5.1-cola-de-correos.md`).
  - No crees tu propia cola.
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
- **5.2:** `E07-Link-barbero`. Los correos E-01 a E-06 no están en el repo: pídeselos al fundador.

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
- Una rama por tarea desde `main` actualizado: `hito-5-plataforma`, `hito-4-cierre-dia`, `hito-5-envio-resend`, `hito-5-suscripcion` y `hito-6-pwa`.
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
| `supabase/config.toml` | Las secciones nuevas (`[functions.<nombre>]`) van al final. Avísalo en el PR. |
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
