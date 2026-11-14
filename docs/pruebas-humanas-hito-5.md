# Pruebas humanas: hito 5

Pruebas que hacen **el fundador y su socio, en persona, con celulares reales**, sobre `https://www.yapoin.com` (base de desarrollo `barberias-dev`). El formato es el de `docs/pruebas-humanas-hitos-2-y-3.md`. Para cada hallazgo, anoten:
- la pantalla;
- qué hicieron;
- qué esperaban;
- qué pasó;
- una captura.

**Criterio de cierre del plan:** "Una cita de prueba recibe confirmación y recordatorio reales por correo, que llegan a la bandeja de entrada de Gmail y Outlook, y una barbería vencida se suspende y se reactiva al registrar el pago."

## Tarea 5.4: panel de plataforma (celular A, super admin)

Se entra con `admin-prueba@yapoin.com`. Conviene usar una barbería de prueba creada para esto, no una piloto.

- [ ] **1. Encontrar la barbería.**
  1. En "Barberías", buscar por el nombre de la barbería, luego por el nombre del dueño y luego por su correo. Las tres búsquedas deben encontrarla.
  2. Tocar los filtros: los números de cada uno deben sumar el total de "Todas".
- [ ] **2. La ficha.** Abrir la barbería. Deben salir el dueño, su correo, su celular, el link, las citas del mes pasado, los barberos activos y la fecha de registro.
- [ ] **3. Registrar un pago.**
  1. Tocar "Registrar pago". El valor debe ser el del plan ($25.000) y el periodo, "1 mes".
  2. Cambiar la fecha del pago y ver que "Queda activa hasta" cambia.
  3. Elegir el medio, escribir una referencia y tocar "Registrar y activar".
  4. La ficha dice "Pago registrado.", el pago sale en la lista y la barbería queda "Activa" hasta la nueva fecha.
- [ ] **4. Anular el pago.** Tocar "Anular" en el pago, escribir el motivo y confirmar. El pago queda tachado con su motivo, y la fecha de vencimiento vuelve a la anterior.
- [ ] **5. Extender la prueba** (en una barbería que todavía no ha pagado). Tocar "Extender prueba", elegir los días y confirmar. La nueva fecha debe ser la que mostró la hoja.
- [ ] **6. Suspender y reactivar.**
  1. Tocar "Suspender" y "Suspender ahora". En otro celular, su página pública deja de recibir reservas. (El panel del dueño en solo lectura llega con la 5.5: todavía no se prueba.)
  2. Tocar "Reactivar" y confirmar. Todo vuelve a funcionar.
  3. En una barbería vencida y suspendida, "Reactivar" debe pedir que se registre un pago. Al registrarlo, se reactiva sola.
- [ ] **7. Métricas.** Tocar el ícono de métricas. Las cuatro tarjetas deben sumar el total de "Todas" (una barbería por vencer cuenta en "Activas" o en "En prueba", según su estado), y el ingreso del mes debe ser la suma de los pagos no anulados de este mes.
- [ ] **8. Solo el super admin.** Con la cuenta de un dueño, abrir `www.yapoin.com/admin`: debe llevarlo a su panel, sin mostrar nada de la plataforma.

## Decisiones provisionales de la 5.4 para revisar juntos
Están en `docs/tareas/5.4-panel-plataforma.md`, de P1 a P11.
