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
| 5.5 Ciclo de suscripción, migración 10 y avisos en la agenda (D-70 a D-72) | Socio | Fusionada (5.5a #63, 5.5b #72) |
| 5.6 Precio por número de barberos (25.000, 40.000 o por acuerdo) | Fundador (la tomó del socio el 2026-11-14) | Fusionada (#73) |
| 6.3 eliminada: solo web | — | — |
| 5.1 Cola de correos | Fundador | Fusionada (#56) |
| 5.2 Envío con Resend: el `Sender`, las plantillas, los rebotes y el SMTP de Auth (decisión 0008) | Socio (antes del fundador) | Fusionada (#61); ajustes de la revisión en `hito-5-correos-ajustes` |
| 5.3 Correos de las citas y recordatorio | Fundador | Fusionada (#66) |
| "Mis citas" del cliente (C-19 a C-21, P2; sale de la 5.5) | Fundador | Fusionada (#68) |
| 4.2b Cerrar las rutas viejas de edición de citas para el dueño | Fundador | Fusionada (#54) |
| 5.4b Correcciones de la revisión de seguridad de la 5.4 (pagos repetidos, anular, fechas en la base, rastro) | Fundador | Fusionada (#60) |
| 6.5 Términos de uso y política de datos personales | Fundador | Fusionada (#69) |
| 6.4 y 6.6 Producción y barberías piloto (las piloto se registran por el camino normal) | Fundador | El código está fusionado (#70). La nube la crean el fundador y el socio con `docs/operacion/infraestructura-produccion.md` |
| 6.1 E2E de los 3 flujos | Fundador | Fusionada (#74) |
| Diagnóstico de rendimiento: por qué un toque tarda cerca de 1 s (`docs/tareas/rendimiento-diagnostico.md`) | Fundador | Diagnóstico terminado (#81); el informe trae las causas y el plan correctivo. El fundador decidió hacer las correcciones 1 a 4 en un solo PR (la fila siguiente); la 5, la 6 y la 7 siguen en espera |
| Correcciones de rendimiento 1 a 4 del diagnóstico: respuesta inmediata en todos los toques, una espera menos por pantalla, guardar y la reserva sin viajes (`docs/tareas/perf-respuesta-inmediata.md`) | Fundador | Fusionada (#84 y el ajuste #85). Tocó el link del barbero (4.4), el cierre (4.6), el admin y `access.ts` (#79). Los números de después están en la ficha |
| 6.2 Prueba en celulares reales | Los dos | Al final, con las pruebas humanas |
| **Fase 7: mejoras de la revisión del 2026-11-15** (`docs/mejoras-revision-2026-11-15.md`; el reparto y sus reglas, en `docs/reparto-mejoras.md`) | — | — |
| 7.1 Lenguaje neutral: "establecimiento" y "profesional" en toda la plataforma (`docs/tareas/7.1-lenguaje-neutral.md`) | Fundador | Fusionada (#90). Ya se pueden editar textos con la regla de siempre: cada quien en su bloque, y con "establecimiento" y "profesional". Las direcciones visibles (`/panel/profesionales`, `?profesional=`) también, en la 7.1b (#98) |
| 7.2 Registro: tipo de establecimiento y volver de los textos legales sin perder lo escrito (`docs/tareas/7.2-registro.md`) | Fundador | Fusionada (#92). No vuelve a definir la función del registro: el tipo se guarda con un disparador aparte, y la 7.8 puede hacer lo mismo con el plan |
| 7.3 Asistente: servicios genéricos, formulario de profesional vacío y ubicación obligatoria (`docs/tareas/7.3-asistente.md`) | Fundador | Fusionada: los servicios y el formulario (#93) y la ubicación obligatoria por GPS (#100), con un paso nuevo del asistente y un disparador en `barbershops` |
| 7.4 Bloqueos del profesional: "todo el día" y no bloquear lo ya cerrado (`docs/tareas/7.4-bloqueos.md`) | Fundador | Fusionada (#94). Volvió a definir `create_time_block_by_barber` |
| 7.5 Aviso de reserva al profesional, con WhatsApp (`docs/tareas/7.5-aviso-profesional.md`) | Fundador | Fusionada (#95 y #99: el celular del cliente es obligatorio al reservar). Falta desplegar la función en `barberias-dev`. Toca `send-notifications` (`appointment-emails.ts` e `index.ts`): hay que desplegar la función. Cambia la política de datos: `LEGAL_VERSION` es `2026-11-15.3` |
| 7.6 Cuentas de profesional por invitación (reemplaza el link privado) | Fundador | Fusionada completa (`docs/tareas/7.6-cuentas-profesional.md`): 7.6a la base (#103, #104), 7.6b invitación y "Mi agenda" con sesión (#106), 7.6c eliminar un profesional y quitar el link privado (#108). Las columnas del link en `barbers` se borran en una migración posterior. Falta pegar `supabase/templates/invite.html` en el panel de Supabase |
| 7.7 Cita inmediata | Fundador | Fusionada (#109, `docs/tareas/7.7-cita-inmediata.md`). Origen nuevo `walk_in`; el profesional crea citas por `create_my_walk_in`. Tres puntos esperan al fundador: fuera de horario, precios visibles para el profesional y tope diario |
| 7.8 Prueba de 30 días y planes: precios, elegir el plan al registrarse, plan por acuerdo a WhatsApp | Socio | En dos partes: 7.8a (30 días, el plan en el registro, el límite de profesionales y el cobro por plan) fusionada (#105); 7.8b ("Cambiar plan" con aprobación por pago) fusionada (#107) |
| 7.9 Afiche en la pantalla final y en Compartir; logo oficial | Socio | Fusionada (#111). D1 resuelta: el logo es el peine del ícono |
| 7.10 Servicios tocables en la página pública | Socio | Fusionada (#91) |
| 7.11 Intervalo de reserva configurable (15, 30 o 60 minutos) | Socio | Fusionada (#112). D8 tomada como provisional |
| 7.12 Panel de plataforma para computador, con métricas | Socio | Fusionada (#102) |
| **Fase 8: tareas 11 a 15 que pasó el socio el 2026-11-17** (las fichas en `docs/tareas/8.N-<tema>.md`; las pruebas humanas en `docs/pruebas-humanas-hito-8.md`) | — | — |
| Actualización de seguridad de Next.js (`ci-next-seguridad`) | Socio | Fusionada (#114): 16.4.4 → 16.4.6 |
| 8.11 Invitación del profesional: directo a crear la contraseña, con el nombre del establecimiento (`docs/tareas/8.11-invitacion.md`) | Fundador (la pasó el socio el 2026-11-17) | Fusionada (#118). El flujo es el de la 7.6b; cambian `/auth/confirm` y la bienvenida. Sin migración. **Falta pegar la plantilla "Invite user" en Supabase** (`supabase/templates/invite.html`): sin eso el correo genérico sigue llevando a la landing |
| 8.12 Sin casilla de avisos: todo profesional con correo recibe los avisos de sus citas | Socio, terminada por el fundador | Fusionada (#116, `docs/tareas/8.12-avisos-siempre.md`). Reemplaza la respuesta 5 de la decisión 0010, aceptado por el fundador |
| 8.13 Compartir el link de reservas desde el panel del profesional (`docs/tareas/8.13-compartir-profesional.md`) | Fundador (la pasó el socio el 2026-11-17) | Fusionada (#117). El botón ya existía desde la 7.6b (#106); se agregó la prueba de punta a punta. Sin migración |
| 8.14 El dueño bloquea solo su propia agenda ("Bloquear mi agenda") (`docs/tareas/8.14-bloquear-mi-agenda.md`) | Fundador (la pasó el socio el 2026-11-17) | Fusionada (#119). Volvió a definir `public.create_time_block` y `private.create_time_block_of`; la regla `already_closed` vive ahora en `private.block_has_open_time` |
| 8.15 Más opciones de intervalo: 5, 10, 15, 30 y 60 minutos | Socio | Fusionada (#115) |
| 8.16 La invitación al profesional sale sola al guardarlo | Socio | Fusionada (#121) |
| 8.17 Invitar a los profesionales al terminar el asistente | Socio | Fusionada (#122) |

**Orden del socio:** **5.4 → 4.6 → 5.2 → 5.5** (la 5.6 la tomó el fundador) (la 6.3 se eliminó: solo web). **En la fase 7: 7.10 → 7.12 → 7.8 → 7.9 → 7.11** (`docs/reparto-mejoras.md`). **En la fase 8: Next.js → 8.15 → 8.12 → 8.13 → 8.14 → 8.11**, una rama y un PR por tarea; las migraciones se fusionan en ese orden. pgTAP de la fase 8: 84 (8.15), 85 (8.12), 86 (8.14) y 87 (8.11).

> [!important] Respuestas del fundador (2026-11-14)
> Lee la sección "Respuestas del fundador", al final de la sección 2: trae los datos de pago, los precios por barberos y lo que ya quedó decidido.

> [!note] Pruebas inestables del horario: arreglado (2026-11-15)
> El socio avisó que dos pruebas de `src/app/(panel)/panel/horario/shop-hours-editor.test.tsx` fallaban a veces con `pnpm test:coverage`, porque `findBy…` esperaba solo 1 segundo.
>
> - **El arreglo:** `src/ui/pruebas/setup.ts` sube la espera por defecto a 5 segundos para todas las pruebas de pantalla (`configure({ asyncUtilTimeout: 5_000 })`), la opción 2 de su nota.
> - **Otra prueba inestable:** en las corridas apareció una más, `holidays-editor.test.tsx › adds a closure from its sheet`. Revisaba que la hoja estuviera cerrada justo cuando salía el aviso, y la hoja se cierra un instante después. Ahora espera a que se cierre y a que las horas se actualicen.
> - **Comprobación:** con los dos arreglos, `pnpm test:coverage` pasó 4 veces seguidas sin fallos (1.461 pruebas). Antes, la de festivos falló en 2 de 9 corridas.
>
> Si escribes una prueba de pantalla nueva, usa `findBy…` o `waitFor` para lo que aparece después de un clic, nunca `getBy…` justo después.

- La 5.2 va antes de la 5.5 porque es el camino crítico: la 5.3 del fundador y los correos de la 5.5 la necesitan.
- Si una tarea queda frenada esperando una respuesta del fundador, avanza la siguiente y vuelve después.
- Si terminas todo, pide más al fundador. No tomes una tarea de otra persona sin cambiar el tablero en un PR.

**Por qué este reparto:** cada persona es dueña de un tema completo.
- **El socio tiene suscripciones y plataforma:**
  - `/admin`;
  - la fórmula de fechas y su ciclo (5.4 y 5.5, que usan la misma fórmula);
  - el cierre del día en `/panel/cierre`, una pantalla nueva y aislada;
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

**La configuración de Resend la hace el socio** (decisión del fundador, 2026-11-14), con `docs/operacion/configurar-resend.md`:
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

### Respuestas del fundador (2026-11-14)
- **Datos de pago** para los correos de suscripción (decisión E5 de la 5.2) y para los avisos de la 5.5:
  - **llave Bre-B:** `3229381101`;
  - **Nequi:** `3229381101`;
  - **correo para los comprobantes:** `manuelalejo429@gmail.com`.

  Son los datos del fundador, y él decidió publicarlos en este repo (es público). Van en los secretos de la Edge Function `PAYMENT_BRE_B`, `PAYMENT_NEQUI` y `PAYMENT_EMAIL` de `barberias-dev` (y de producción en la 6.4). Donde una pantalla muestre los datos de pago (D-70 a D-72), usa estos mismos.
- **El valor del plan depende de cuántos barberos tiene la sede** (tarea 5.6):

  | Barberos activos de la sede | Precio al mes |
  | --- | --- |
  | 1 a 4 | $25.000 |
  | 5 a 8 | $40.000 |
  | 9 o más | Por acuerdo con el área financiera de Yapoin |

  - El dueño que corta ("Yo también corto") cuenta como barbero.
  - Mientras no exista la 5.6, los avisos dicen $25.000.
- **Cuentas sin confirmar:** se borran a los **7 días** (5.5). Ya lo construiste así.
- **La configuración de Resend es tuya** (`docs/operacion/configurar-resend.md`).
- **La contraseña de `admin-prueba@yapoin.com`:** nadie la conoce, porque Supabase guarda solo su huella. Se cambia con la sección "Cambiar la contraseña" de `docs/operacion/crear-super-admin.md`, y el fundador te la pasa por fuera del repo.
- **Los correos E-01 a E-06 no tendrán diseño:** el fundador autorizó a Claude Code a diseñarlos. Tu base sobre E-07 se queda (decisión E4).
- **Las pruebas humanas se hacen todas al final,** con el producto terminado. No esperes a ellas.

### 5.6 Precio por número de barberos (después de la 5.5)
- **Regla:** la tabla de "Respuestas del fundador". Cambia la spec ("Plan único" pasa a tres precios) y el catálogo `plans` (decisión 0006).
- **Qué hay que construir:**
  - el catálogo con los tres niveles: 1 a 4 y 5 a 8 con su precio; 9 o más sin precio fijo;
  - `register_subscription_payment` toma el precio según los barberos activos de la sede al registrar el pago;
  - para "por acuerdo", el super admin escribe el valor en P-03, con un tope razonable y su prueba;
  - P-03 y la ficha (P-02) muestran el nivel y el valor;
  - los avisos de suscripción (5.2 y 5.5) dicen el valor que le toca a esa sede.
- **Decisiones provisionales que propone Claude Code** (confírmalas con el fundador y anótalas en `docs/tareas/5.6-precio-por-barberos.md`):
  1. el nivel se mide al registrar cada pago, con los barberos activos ese día; agregar un barbero nunca se bloquea;
  2. si una sede pasa de 4 a 5 barberos a mitad de mes, paga el nuevo valor desde el siguiente pago;
  3. una sede de 9 o más sin valor acordado no se puede pagar desde P-03 hasta que el super admin escriba el valor.
- **Ojo, es dinero:** pasa `revisor-seguridad`, como en la 5.4.

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

### 6.3 eliminada: solo web

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
- Una rama por tarea desde `main` actualizado: `hito-5-plataforma`, `hito-4-cierre-dia`, `hito-5-envio-resend` y `hito-5-suscripcion`.
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
| `src/ui/textos.ts` | Un bloque propio de primer nivel (`plataforma: { … }`, `cierre: { … }`, `suscripcion: { … }`), puesto **justo antes de `  proximamente: {`**. No edites bloques ajenos; si necesitas un texto de otro bloque, impórtalo. |
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
- Agrega las pruebas humanas de tu tarea a `docs/pruebas-humanas-hito-<n>.md`. **Se hacen todas juntas cuando el producto esté terminado** (decisión del fundador, 2026-11-14): no esperes a ellas para seguir con la siguiente tarea.

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
