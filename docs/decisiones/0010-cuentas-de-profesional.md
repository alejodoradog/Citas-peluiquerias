# 0010 Cuentas de profesional por invitación

Fecha: 2026-11-15 · Tarea: 7.6 (y lo que cuelga de ella: 7.7 y parte de la 7.5) · Estado: **aceptada** por el fundador el 2026-11-15, con las siete recomendaciones de la tabla final. La redactó Claude Code.

Cambia una regla de la spec. Hoy "los barberos no necesitan cuenta y ven su agenda desde un link privado", y las cuentas por barbero estaban en "Fase 2". El profesional entra con su propia cuenta y el link privado desaparece.

## Contexto

- **Lo pidieron el fundador y el socio** en la revisión del 2026-11-15 (hallazgo 2): el link privado les parece delicado, porque quien lo tenga entra a la agenda.
- **Ya decidido por el fundador (2026-11-15):** al eliminar a un profesional se borran su cuenta y sus datos personales, y sus citas quedan a nombre de "Profesional eliminado".
- **Cómo funciona hoy:**
  - el profesional abre `/b/<link>` y ve su agenda, marca citas y bloquea horas. No ve el celular, el correo ni el precio de los clientes, ni los totales, ni a los demás profesionales;
  - todo pasa por cinco funciones de la base que reciben el link (`barber_agenda`, `barber_appointment`, `mark_appointment_by_barber`, `create_time_block_by_barber` y `delete_time_block_by_barber`);
  - el correo del profesional es opcional.
- **El riesgo que hay que evitar.** Los permisos de la base dan a cualquier miembro de un establecimiento todo lo que ve el dueño: clientes, pagos, configuración. Si el profesional entrara como un miembro más, vería todo eso.

## Decisión

1. **El profesional tiene cuenta, pero no es miembro del establecimiento.**
   - Su cuenta queda unida a su fila de profesional (`barbers.profile_id`), no a la tabla de miembros.
   - Los permisos de las tablas no cambian. Una cuenta de profesional no lee ninguna tabla directamente.
   - Todo lo que hace pasa por funciones de la base que solo entregan lo suyo: las mismas cinco de hoy, que en vez del link miran quién tiene la sesión abierta.
   - Así, lo que el profesional puede ver sigue siendo exactamente lo de hoy, más lo que esta decisión agrega (punto 6).

2. **La cuenta solo se crea por invitación del dueño.**
   - El dueño escribe el correo del profesional en su ficha y toca "Invitar". El correo pasa a ser obligatorio para invitar.
   - Llega un correo de Yapoin con un botón. El profesional lo abre, crea su contraseña y entra a su agenda.
   - La base une la cuenta con el profesional solo si esa cuenta nació de una invitación del sistema y su correo es el invitado. Registrarse por la página normal con ese correo no une nada.
   - La invitación vence a los 7 días y se puede reenviar. Hay un tope de invitaciones por establecimiento al día, contra el abuso.

3. **Un correo, una cuenta, un establecimiento** (provisional).
   - Un correo que ya tiene cuenta en Yapoin, de dueño o de profesional, no se puede invitar. El formulario lo dice sin revelar de quién es.
   - Trabajar en dos establecimientos con la misma cuenta queda para después.

4. **El ingreso es el mismo de todos** (`/ingresar`). Según la cuenta, lleva al panel del dueño, al panel de plataforma o a "Mi agenda" del profesional (`/mi-agenda`).

5. **Las pantallas del profesional son las de hoy** (B-01 a B-04), movidas de `/b/<link>` a `/mi-agenda`. Se suma "Cerrar sesión".

6. **Lo que el profesional gana con la cuenta:**
   - **Compartir:** un botón con el link de reservas del establecimiento, que lo trae a él ya elegido.
   - **WhatsApp del cliente** en el detalle de sus propias citas (lo pidió la revisión, hallazgo 8). Solo de sus citas, y solo el celular: no el correo ni las notas.
   - **Cita inmediata** (tarea 7.7).

7. **Eliminar a un profesional** (nuevo, además de "Desactivar"):
   - no se puede mientras tenga citas por venir: primero se pasan a otro profesional o se cancelan;
   - se borra su cuenta de ingreso y su perfil;
   - su fila queda como "Profesional eliminado", sin correo, sin foto e inactiva, para que las citas pasadas, el cierre del día y el historial de los clientes sigan cuadrando.

8. **El link privado se quita:**
   - las rutas `/b/…`, las pantallas "Link privado" de Más, el correo del link y la parte de links de Compartir;
   - las funciones dejan de aceptar un link;
   - las columnas del link en la base se quedan por ahora y se borran en una migración posterior, para no tocar todas las pruebas en el mismo cambio.
   - No hay links en uso que migrar: la base de pruebas se vació el 2026-11-15 y producción no existe.

9. **El dueño que también atiende no cambia.** Ya tiene cuenta y ve su agenda en el panel.

## Cómo se construye
Tres PR, cada uno con `ingeniero-critico` y `revisor-seguridad`:

| PR | Qué trae |
| --- | --- |
| 7.6a Base de datos | `barbers.profile_id`, las invitaciones, las funciones por sesión y sus pruebas. Las del link siguen vivas |
| 7.6b Invitación y "Mi agenda" | Invitar desde la ficha, el correo, crear la contraseña, `/mi-agenda`, el ingreso por tipo de cuenta, compartir y WhatsApp |
| 7.6c Eliminar y limpiar | Eliminar un profesional, y quitar el link privado de la aplicación y de las funciones |

## Costos y riesgos
- **Más fricción para el profesional.** Hoy abre un link; con esto necesita un correo, abrir la invitación y recordar una contraseña. Un profesional sin correo no puede ver su agenda.
- **Es el cambio más delicado de la fase.** Entra un tipo de cuenta nuevo. El punto 1 lo acota: como no es miembro, un error en una pantalla no le abre las tablas. Lo que hay que revisar función por función es que cada una mire solo al profesional de la sesión.
- **Correos de invitación.** Salen por Supabase Auth con el SMTP de Resend, como la confirmación de la cuenta. Hay que crear la plantilla y pegarla en el panel de Supabase, y cuentan en el límite de correos de Auth.
- **La llave de servicio.** Invitar y borrar una cuenta solo se puede con la llave de servicio, desde el servidor. Esas dos acciones comprueban antes que quien las pide es el dueño de ese profesional.
- **Unas dos semanas de trabajo** con sus revisiones. La spec estimaba una.

## Lo que decidió el fundador (2026-11-15)
Respondió "sí a todo": cada pregunta queda como dice su recomendación.

| # | Pregunta | Decidido |
| --- | --- | --- |
| 1 | ¿El profesional entra con correo y contraseña? | Sí, como el dueño. Es lo que ya existe y está probado. |
| 2 | ¿Se puede invitar un correo que ya tiene cuenta? | No por ahora (punto 3). |
| 3 | ¿El profesional ve el celular del cliente en su agenda? | Sí, solo de sus citas (punto 6). |
| 4 | ¿Su link para compartir lo trae ya elegido? | Sí. |
| 5 | ¿Qué pasa con el aviso de cada reserva? | Queda activado desde que acepta la invitación; el dueño lo puede apagar. **Reemplazada por la tarea 8.12 (2026-11-17):** todo profesional con correo recibe siempre los avisos de sus citas y el dueño ya no los apaga (`docs/tareas/8.12-avisos-siempre.md`). |
| 6 | ¿Un profesional sin correo? | No tiene acceso. El dueño sigue viendo y manejando su agenda desde el panel. |
| 7 | ¿Cuántas invitaciones al día por establecimiento? | 20. |
