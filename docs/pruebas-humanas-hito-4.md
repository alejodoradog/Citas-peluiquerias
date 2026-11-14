# Pruebas humanas: hito 4

Pruebas que hacen **el fundador y su socio, en persona, con celulares reales**, sobre `https://www.yapoin.com` (base de desarrollo `barberias-dev`). El formato es el de `docs/pruebas-humanas-hitos-2-y-3.md`. Para cada hallazgo, anoten:
- la pantalla;
- qué hicieron;
- qué esperaban;
- qué pasó;
- una captura.

**Criterio de cierre del plan:** "El dueño maneja un día completo de trabajo solo desde el panel, y el barbero ve sus citas desde su link."

## Tarea 4.2: la cita desde el panel (celular A, dueño)

- [ ] **1. Cita manual de alguien que llegó sin cita.**
  1. Tocar un espacio libre de la agenda. Se abre "Nueva cita" con ese barbero, ese día y esa hora.
  2. Escribir un nombre nuevo y tocar "Crear cliente nuevo".
  3. Dejar el correo vacío. Debe salir "Sin correo no hay confirmación ni recordatorio".
  4. Marcar un servicio y tocar "Crear cita".
  5. Debe abrir el detalle con "Creaste la cita.", y la cita debe aparecer en la agenda, gris ("Manual").
- [ ] **2. Cita manual para un cliente que ya existe.** En "Buscar o escribir nombre", escribir parte de su nombre, correo o celular. Debe aparecer en la lista con sus visitas. Al elegirlo, el formulario no pide correo.
- [ ] **3. Agregar la barba en la silla.**
  1. En el detalle, tocar el lápiz y marcar otro servicio. El total cambia antes de guardar.
  2. Guardar. El detalle muestra los dos servicios y el nuevo valor.
  3. En la agenda, la tarjeta se alarga.
- [ ] **4. Reprogramar.**
  1. Tocar "Reprogramar".
  2. Cambiar de barbero y de día, y elegir una hora. Solo deben salir horas libres de ese barbero.
  3. Tocar "Guardar cambio". La cita aparece en su nuevo lugar de la agenda.
- [ ] **5. Marcar.**
  1. En una cita que ya empezó, tocar "No asistió" y confirmar en la hoja.
  2. Después corregir a "Atendida".
  3. En una cita que todavía no empieza no deben salir esos botones.
  4. Con 2 inasistencias, la ficha del cliente muestra la alerta.
- [ ] **6. Cancelar.**
  1. Tocar "Cancelar cita" y confirmar. La hora queda libre en la agenda.
  2. La cita cancelada ya no ofrece ningún botón.
  3. Por ahora no se avisa al cliente: el correo llega en el hito 5.
- [ ] **7. Bloquear horas.**
  1. Desde "Nueva cita", tocar el candado de arriba.
  2. Elegir un barbero y un horario donde tenga una cita. Debe salir el aviso amarillo con esa cita, y "Bloquear" queda apagado.
  3. Cambiar a un horario libre, elegir "Almuerzo" y bloquear. En la agenda se ve el bloque rayado.
- [ ] **8. Quitar un bloqueo.** Tocar el bloque rayado en la agenda y luego "Quitar bloqueo". La hora vuelve a estar libre.
- [ ] **9. Toda la barbería.** Bloquear una hora a "Toda la barbería". Debe salir en la columna de todos los barberos, y la página pública no debe ofrecer esa hora.
- [ ] **10. Dos personas a la vez (celulares A y B).** Mientras A tiene abierta "Nueva cita" en una hora, B reserva esa misma hora desde la página pública. Cuando A toque "Crear cita", debe decir "Esa hora ya la tomaron".

## Tarea 4.4: "Mi agenda" del barbero (celular A, dueño, y celular B, barbero)

- [ ] **1. Abrir el link.**
  1. En el celular A, ir a Más › Barberos › un barbero › Link y tocar "Copiar link nuevo".
  2. Pasarlo al celular B y abrirlo sin sesión. Debe salir "Hola, …" con sus citas de hoy y "Hoy tienes N citas · la próxima a las …".
- [ ] **2. Nada de dinero ni de otros barberos.** En el día, la semana y el detalle de una cita no debe salir ningún precio, total, correo ni celular del cliente, ni las citas de otro barbero.
- [ ] **3. La semana.** Tocar "Semana". Cada día muestra su horario o "Descansas", y cuántas citas tiene. Tocar un día abre ese día.
- [ ] **4. Marcar.** En una cita que ya empezó, tocar "Atendida". En el celular A, la agenda la muestra como atendida. Una cita que todavía no empieza no tiene esos botones.
- [ ] **5. Bloquear horas.**
  1. En el celular B, tocar "Bloquear horas", elegir un rango libre y "Almuerzo", y tocar "Bloquear".
  2. El bloqueo sale en el día del barbero y en la agenda del celular A.
  3. Intentar bloquear un rango con una cita: debe decir que tiene una cita en ese rango.
  4. Tocar "Quitar" en el bloqueo. Desaparece en los dos celulares.
- [ ] **6. Link desactivado.** En el celular A, desactivar el link del barbero. Al recargar el celular B debe salir "Este link ya no funciona".

## Decisiones provisionales de la 4.2 para revisar juntos
Están en `docs/tareas/4.2-detalle-cita.md` (M1 a M8). Las que más se notan:
- **El candado de "Nueva cita"** es la entrada a "Bloquear horas", porque el diseño no dice desde dónde se abre (M6).
- **Una cita cancelada no se puede reactivar** (M3).
- **No hay interruptor de abono** (M8).
