# 0001 Modelo de datos

Fecha: 2026-11-04 · Tarea: 1.1 · Estado: aceptada por el dueño del proyecto; **reemplazada en parte** por la decisión 0006 del esquema final (`docs/decisiones/0006-esquema-base-de-datos-final.md`, puntos 2, 4, 7, 9 y 13: `memberships`, `plans`, `appointment_services`, `appointment_events` y el fin de `profiles.role`, `profiles.barbershop_id`, `appointments.service_id` y `billing_period`). La decisión 0006 de correo único cambia los datos de contacto de `customers` y `barbers`, y quita el canal de `notifications`.

## Contexto

La spec define 11 tablas con nombres en español. El código va en inglés y las reglas críticas se protegen en la base de datos. Este documento fija los nombres, las decisiones que la spec no resolvía y el porqué de cada una.

## Glosario de tablas

| Spec | Tabla | Para qué |
| --- | --- | --- |
| barberias | `barbershops` | Raíz de cada barbería (tenant) |
| usuarios | `profiles` | Cuentas de dueño y super admin; `id` = `auth.users.id` |
| barberos | `barbers` | Barberos sin cuenta, con link privado |
| horarios_barbero | `barber_schedules` | Horario semanal de cada barbero |
| — | `barbershop_hours` | Horario semanal de la barbería, con jornadas partidas |
| — | `holiday_openings` | Festivos en que la barbería sí abre |
| servicios | `services` | Servicios con precio y duración |
| barbero_servicio | `barber_services` | Qué servicios hace cada barbero |
| bloqueos | `time_blocks` | Horas bloqueadas de un barbero o de toda la barbería |
| clientes | `customers` | Clientes de cada barbería |
| citas | `appointments` | Citas |
| notificaciones | `notifications` | Cola de mensajes |
| pagos_suscripcion | `subscription_payments` | Historial de cobros |

Valores de los estados:

| Spec | Valor |
| --- | --- |
| Confirmada, Atendida, No asistió | `confirmed`, `attended`, `no_show` |
| Cancelada por cliente, Cancelada por barbería | `cancelled_by_customer`, `cancelled_by_barbershop` |
| Origen web o manual | `web`, `manual` |
| En prueba, activa, suspendida | `trial`, `active`, `suspended` |
| Básico, Pro | `basic`, `pro` |
| Mensual, trimestral, anual | `monthly`, `quarterly`, `annual` |
| Transferencia, Nequi, Daviplata, llave Bre-B | `bank_transfer`, `nequi`, `daviplata`, `bre_b` |

## Decisiones

1. **13 tablas en vez de 11.**
   - El horario de la barbería va en `barbershop_hours`, no como un campo de `barberias`, para permitir jornadas partidas y que el motor de disponibilidad lo lea igual que el horario del barbero.
   - Los festivos se deciden uno por uno. Todos están cerrados por defecto y `holiday_openings` guarda solo los días que la barbería abre, con su horario normal de ese día de la semana. La lista de festivos sale de `src/lib/fechas`, no de la base de datos. Cerrado por defecto es el error menos grave: sin configurar, nadie reserva un día en que la barbería no abre.
2. **`barbershop_id` en todas las tablas de negocio, y llaves foráneas compuestas `(barbershop_id, id)`.** La base de datos rechaza que una fila de la barbería A apunte a un barbero, servicio, cliente o cita de la B, aunque el código tenga un error. `profiles` es la única con `barbershop_id` vacío, y solo para el super admin.
3. **RLS activado en todas las tablas desde el inicio, sin políticas.** Nada se puede leer ni escribir por la API hasta que la tarea 1.2 agregue las políticas. Una prueba falla si cualquier tabla de `public`, presente o futura, no tiene RLS o no tiene `barbershop_id`.
4. **Una sola cuenta de dueño por barbería**, con un índice único. Fase 2 (roles) lo cambiará.
5. **Tokens solo como hash.** `barbers.link_token_hash` y `appointments.manage_token_hash` guardan el SHA-256 en hexadecimal; el token original nunca se guarda.
6. **Tipos de fecha.**
   - Instantes (citas, bloqueos, notificaciones) en `timestamptz`, en UTC.
   - Fechas de calendario (vence el, festivos, fechas de pago y de cobertura) en `date`, entendidas en hora de Colombia.
   - Horarios semanales en `time`, hora local de Colombia.
   - `weekday` va de 0 (domingo) a 6 (sábado), igual que `getWeekday` de `src/lib/fechas`.
7. **Suscripción.**
   - Solo se guardan los estados `trial`, `active` y `suspended`. "Por vencer", "vencida" y "en gracia" se calculan a partir de `expires_on`, sin tareas programadas que cambien estados.
   - `plan` queda vacío durante la prueba gratis y se llena con el primer pago. Una barbería `active` siempre tiene plan.
   - `expires_on` es el último día de servicio, también durante la prueba.
8. **Visitas e inasistencias se calculan desde `appointments`**, en lugar de guardarse como contadores que pueden desincronizarse.
9. **La cita copia el precio** (`price_cop`) al reservar, para que un cambio de precio no reescriba el historial.
10. **El historial no se borra en cascada.** Las relaciones usan `on delete restrict`, salvo horarios y servicios de un barbero, que se van con él. Borrar un cliente por la Ley 1581 se resolverá anonimizando sus datos.
11. **Cola de notificaciones sin duplicados.** Cada mensaje lleva una `dedupe_key` única; además `attempts` y `last_error` para los reintentos.
12. **Celulares en formato E.164** (`+573001234567`), validados con un check. La aplicación los normaliza antes de guardar.
13. **Enums de Postgres para los estados**, para que los tipos generados de TypeScript tengan los valores exactos. Agregar un valor es fácil; quitarlo no.
14. **Funciones auxiliares en el esquema `private`**, que la API de Supabase no expone.

## Pendiente para otras tareas

- Políticas RLS: 1.2.
- Constraint de exclusión para que las citas no se crucen: 1.3.
- Validar en la aplicación que `holiday_openings` solo reciba fechas que son festivos: 2.4.
- Límite de barberos por plan durante la prueba gratis: 5.4.
