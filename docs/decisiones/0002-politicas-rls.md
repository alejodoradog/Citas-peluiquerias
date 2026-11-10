# 0002 Políticas RLS y permisos

Fecha: 2026-11-04 · Tareas: 1.2 y 1.5 · Estado: aceptada por el dueño del proyecto; **reemplazada en parte** por la decisión 0006 del esquema final (tabla de permisos y punto 4): las políticas `owner_*` de una barbería pasan a `member_*` sobre todas las sedes de la cuenta (`private.member_barbershop_ids()`), y se suman `memberships`, `plans`, `appointment_services` y `appointment_events`.

## Contexto

La tarea 1.1 dejó RLS activado en las 13 tablas, sin políticas. Esta decisión define quién lee y escribe qué. La regla del plan: el dueño solo ve su barbería, el super admin ve todo y el público solo lee lo necesario para reservar.

## Quién puede hacer qué

| Tabla | Público (`anon`) | Dueño (solo su barbería) | Super admin |
| --- | --- | --- | --- |
| `barbershops` | Lee perfil y políticas; no la suscripción | Lee todo; edita perfil y configuración | Lee |
| `profiles` | — | Lee el suyo; edita nombre y celular | Lee |
| `barbers` | Activos, sin correo ni hash | Lee, crea, edita y borra; no lee el hash | Lee, sin hash |
| `services` | Activos | Lee, crea, edita y borra | Lee |
| `barber_services`, `barber_schedules`, `barbershop_hours`, `holiday_openings` | Lee | Lee, crea, edita y borra | Lee |
| `time_blocks` | Lee horas, sin el motivo | Lee, crea, edita y borra | Lee |
| `customers` | — | Lee, crea, edita y borra | Lee |
| `appointments` | — | Lee, crea y edita; no borra; no lee el hash | Lee, sin hash |
| `notifications` | — | — | Lee |
| `subscription_payments` | — | Lee su historial | Lee |

## Decisiones

1. **Permisos en lista blanca.**
   - Se quitan todos los permisos de tabla a `anon` y `authenticated` y se dan solo los necesarios, incluso por columna.
   - Una tabla, secuencia o función nueva queda cerrada hasta que alguien le dé permisos a propósito. Para las funciones también se quita el permiso que Postgres da a todos por defecto, así que una función futura como "registrar pago" no queda expuesta por un descuido.
   - Nadie distinto del dueño de la tabla tiene `truncate`, `references` ni `trigger`.
   - Las pruebas comprueban esto para todas las tablas y funciones, presentes y futuras.
2. **Las columnas sensibles se protegen con permisos por columna, no solo con políticas.**
   - Las políticas eligen filas; los permisos por columna eligen qué datos de esa fila.
   - Por eso un dueño no puede cambiar `subscription_status`, `plan`, `expires_on`, `profiles.role`, `profiles.barbershop_id` ni `profiles.active`.
   - Nadie lee `link_token_hash` ni `manage_token_hash`, aunque se pueden escribir al crear o regenerar un link.
   - Consecuencia para el código: en `barbers` y `appointments` no sirve `select *`; hay que nombrar las columnas.
3. **La página pública siempre consulta sin sesión (`anon`).** Si un dueño con sesión abierta visita la página de otra barbería, la consulta no debe ir con su sesión, porque con ella vería columnas que el público no ve.
4. **Funciones auxiliares** `private.current_barbershop_id()`, `private.is_super_admin()` y `private.current_profile_id()`.
   - Son `security definer` para leer `profiles` sin entrar en un ciclo de RLS.
   - Un dueño o super admin con `active = false` pierde todo el acceso, incluido el de su propio perfil.
   - Un usuario que existe en Auth pero no tiene perfil no ve ni escribe nada.
   - Las políticas las llaman como `(select ...)` para que Postgres las evalúe una vez por consulta y no por fila.
5. **El super admin solo lee.** Registrar pagos, activar, suspender y extender la prueba se hará con funciones `security definer` en la tarea 5.4. Así el pago y la nueva fecha de vencimiento se guardan juntos, y `registered_by` sale de la sesión, no del navegador.
6. **Las citas no se borran**, ni siquiera el dueño: se cancelan.
7. **Los dueños no ven la cola de mensajes** (`notifications`). La spec no tiene esa pantalla. Se abrirá cuando las barberías piloto lo pidan.
8. **Las tareas 1.2 y 1.5 se hacen juntas.** Las pruebas de RLS se escriben primero, junto con las políticas.

## Lo que no cubren las políticas y dónde se resuelve

| Qué | Cómo | Tarea |
| --- | --- | --- |
| Crear la barbería y la cuenta del dueño en el registro | Trigger de registro en la misma transacción que la cuenta (decisión 0004); desde el navegador nadie inserta en `barbershops` ni en `profiles` | 1.4 (hecho) |
| Horas libres en la página pública | Función que devuelve solo rangos ocupados, sin datos de clientes | 3.1 / 3.3 |
| Reservar desde la página pública | Función que valida y crea cliente y cita juntos | 3.3 |
| Gestionar la cita con su link | Función que recibe el token y compara su hash | 3.4 |
| Vista del barbero con su link | Función que recibe el token y compara su hash | 4.4 |
| Panel en solo lectura si la barbería está suspendida | Regla en la base de datos junto con el ciclo de suscripción | 5.5 |
| Registrar pagos, suspender, extender la prueba | Funciones del super admin | 5.4 |
