# "Mis citas" (P2, C-19 a C-21)
Estado: construida el 2026-11-14 en la rama `hito-5-mis-citas`. Falta que pase el CI, y la prueba con Resend cuando el socio lo termine de configurar.
Spec: función 6, "Ver 'mis citas' con un link que llega al correo, sin código" (P2). Decisión 0006 de correo, punto 10: la pantalla responde siempre lo mismo, exista o no el correo. Plan: salía de la 5.5; el fundador la metió en el MVP el 2026-11-14. Sin diseño en el repo: la diseñó Claude Code, con permiso del fundador, con los componentes de `src/ui` y el estilo de C-09.

## Qué hace
1. **C-19** (`/<link>/mis-citas`, desde "Ver mis citas" al pie de la página de la barbería):
   - el cliente escribe su correo;
   - pasa por Turnstile, como la reserva.
2. **C-20:** siempre "Revisa tu correo: si tienes citas próximas en esta barbería, te llegó un link".
   - Solo cambia si falla Turnstile, si se pasa el límite de 5 pedidos por hora desde la misma conexión, o si el correo no tiene forma de correo.
3. **El correo:**
   - "Tus citas en {barbería}", con el botón "Ver mis citas";
   - sale solo si el correo es de un cliente de esa barbería con citas próximas;
   - como máximo 3 por hora por cliente;
   - el link sirve 24 horas.
4. **C-21** (`/<link>/mis-citas/<token>`):
   - las citas confirmadas que vienen, con la hora, los servicios, el barbero y el precio;
   - cada una con "Ver o cambiar", que abre su link de la 3.4 (`/c/<token>`), con Confirmo, Cambiar y Cancelar;
   - un link vencido o falso dice "Este link ya no sirve" y ofrece pedir uno nuevo.

## Base de datos
- **`20261114224958_add_my_appointments_type`:** el tipo de correo `customer_appointments`, en su propia migración para que la siguiente lo pueda usar.
- **`20261114225010_add_my_appointments`:**
  - **Las tablas,** que nadie lee:
    - `private.customer_links`: el hash, la barbería, el cliente y la fecha en que vence;
    - `private.my_appointments_hits`: el hash de la IP, como en la reserva.
  - **Las funciones del servidor, solo para `service_role`:**
    - `request_my_appointments`: la IP, el cliente con citas, el tope de 3 por hora y encolar;
    - `issue_customer_link`.
  - **Las funciones del link, para `anon` y `authenticated`:**
    - `my_appointments(hash)`: las citas sin correo ni celular;
    - `issue_my_appointment_link`: el link de una cita de ese cliente, como máximo 20 por cita.
  - **`notification_recipient`:** el correo nuevo va al cliente del payload, nunca a uno borrado (4.3).
- **La cola** guarda solo el `customer_id` (regla Q5 de la 5.1).

## La Edge Function
`composeMyAppointmentsEmail`, en `appointment-emails.ts`:
- lee el cliente y su barbería;
- se cancela si ya no hay citas próximas;
- crea el token al azar y guarda su hash con `issue_customer_link`.

## Pruebas
- **pgTAP `62_my_appointments`** (21 pruebas):
  - los permisos;
  - la misma respuesta para cualquier correo;
  - quién recibe;
  - los topes por cliente y por IP;
  - el link: 24 horas, solo citas próximas y solo de ese cliente;
  - el link de cada cita.
- **Unitarias:** `composeMyAppointmentsEmail`, en `appointment-emails.test.ts`.
- **E2E:** `tests/e2e/mis-citas.spec.ts`:
  - pedir con un correo desconocido y con el del cliente: la misma respuesta, y un solo correo encolado;
  - abrir la lista y una cita;
  - un link que no sirve.

## Decisiones provisionales (2026-11-14)
1. **(M1) Por barbería,** como los clientes de la base: el link muestra las citas de ese correo en esa barbería, no en todas.
2. **(M2) El link vive 24 horas,** y "Mis citas" no se guarda en el celular; para volver, se pide otro.
3. **(M3) Sin citas próximas no sale correo,** para no gastar envíos. La pantalla dice lo mismo.
4. **(M4) Topes:**
   - por cliente: 3 correos por hora y 5 al día;
   - por dirección de correo: 10 al día entre todas las barberías;
   - por barbería: 100 al día;
   - por conexión: 5 pedidos por hora y por barbería. Sin IP conocida, todos comparten un mismo grupo.

## Revisión de seguridad (2026-11-14)
`revisor-seguridad` no encontró nada alto. Se corrigieron:
- **Los medios:**
  - los topes diarios (M1);
  - el candado por cliente contra pedidos en paralelo (M2);
  - que `my_appointments` e `issue_my_appointment_link` reciban el token y no el hash, así lo que guarda la base no abre nada (M3).
- **Los bajos:**
  - el link de una cita se crea al tocar "Ver o cambiar", no al abrir la lista (B1);
  - las cabeceras de link privado en `next.config.ts` (B2), un archivo compartido;
  - el grupo sin IP (B3);
  - un índice para los conteos (B4);
  - pruebas nuevas (B5).
- **Lo que queda:** las funciones de la 3.4 (`managed_appointment` y las demás) todavía reciben el hash. Pasarlas al token toca la 3.4 y la 5.3, y queda para después.

## Riesgos
- **Cada toque en "Ver o cambiar" crea un link nuevo,** como máximo 20 por cita. Los anteriores siguen sirviendo hasta que la cita pasa.
