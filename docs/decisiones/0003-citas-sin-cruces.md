# 0003 Citas sin cruces

Fecha: 2026-11-04 · Tarea: 1.3 · Estado: aceptada por el dueño del proyecto.

## Contexto

La regla central de la spec: una hora está libre solo si, entre otras cosas, no choca con otra cita activa. Dos clientes pueden estar mirando el mismo espacio y confirmar casi al mismo tiempo; el código de la aplicación no basta para evitar que ambos entren.

## Decisiones

1. **Restricción de exclusión en la base de datos.** `appointments_no_overlap` rechaza dos citas del mismo barbero cuyos horarios se crucen. Usa la extensión `btree_gist`.
2. **Solo cuentan las citas que ocupan el espacio**, según la tabla "Estados de una cita" de la spec: Confirmada, Atendida y No asistió. Las canceladas por el cliente o por la barbería liberan el espacio al instante.
3. **Rangos semiabiertos** `[inicio, fin)`: una cita que termina a las 10:40 y otra que empieza a las 10:40 no se cruzan.
4. **Carreras.** Si dos reservas llegan al mismo tiempo, Postgres hace esperar a la segunda hasta que la primera termine, y luego la rechaza con el código `23P01`. Se comprobó con dos sesiones simultáneas: quedó una sola cita.
5. **Bloqueos y horario no se exigen en la base de datos** (opción A, elegida por el dueño del proyecto). El motor de disponibilidad (3.1) y la reserva pública (3.3) los respetan, así que el cliente nunca reserva encima de un bloqueo. El dueño sí puede agendar a mano en una hora bloqueada, por ejemplo si atiende a alguien en su almuerzo.
6. **Mensaje para el usuario.**
   - `toAppointmentWriteError` (en `src/modulos/agenda/datos`) reconoce el rechazo por el código `23P01` y el nombre de la restricción.
   - `appointmentErrorMessage` (en `src/modulos/agenda/acciones`) lo convierte en "Esa hora ya la tomaron. Elige otra, por favor.", con el texto en `src/ui/textos.ts`.
   - Ningún error técnico llega a la pantalla.
