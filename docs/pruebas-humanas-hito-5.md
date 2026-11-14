# Pruebas humanas: hito 5

Pruebas que hacen **el fundador y su socio, en persona, con celulares reales**, sobre `https://www.yapoin.com` (base de desarrollo `barberias-dev`). El formato es el de `docs/pruebas-humanas-hitos-2-y-3.md`. Para cada hallazgo, anoten:
- la pantalla;
- qué hicieron;
- qué esperaban;
- qué pasó;
- una captura.

**Criterio de cierre del plan:** "Una cita de prueba recibe su recordatorio real por correo, que llegan a la bandeja de entrada de Gmail y Outlook, y una barbería vencida se suspende y se reactiva al registrar el pago."

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

## Tarea 5.4b: correcciones del panel de plataforma (celular A, super admin)

- [ ] **1. Un pago no se registra dos veces.**
  1. Abrir "Registrar pago" de la misma barbería en dos pestañas.
  2. Registrar el pago en la primera.
  3. En la segunda, con el mismo medio y la misma referencia, tocar "Registrar y activar". Debe decir "Ese pago ya está registrado…", y la ficha muestra un solo pago y un solo mes.
  4. Con otra referencia, sí se registra.
- [ ] **2. La fecha del pago.** En una barbería creada hace pocos días, la lista de fechas de "Registrar pago" empieza el día en que se creó, no un mes atrás.
- [ ] **3. Anular sigue funcionando.** Anular un pago desde su ficha: queda tachado con su motivo. Después se puede registrar otra vez esa misma referencia.

## Tarea 5.2: correos con Resend (celular A, dueño)

Antes, el fundador sigue `docs/operacion/configurar-resend.md` en `barberias-dev`.

- [ ] **1. Auth.** Registrarse con un correo nuevo de Gmail y con uno de Outlook. El correo de confirmación llega a la bandeja de entrada (no a spam), en español y desde `citas@yapoin.com`. Lo mismo con "Recuperar clave".
- [ ] **2. Un aviso de suscripción.** Encolar `subscription_expiring` para una barbería de prueba cuyo dueño tenga Gmail, y otra vez para una cuyo dueño tenga Outlook (paso 5 de la guía):
  1. en un minuto llega "Tu prueba gratis vence el …" a la bandeja de entrada, no a spam, con el botón "Abrir mi panel" que lleva a `www.yapoin.com/panel`;
  2. en la tabla `notifications` de `barberias-dev`, ese correo quedó `sent`.

  Es la mitad del criterio de cierre del hito 5.
- [ ] **3. Los datos de pago.** Sin `PAYMENT_*`, el correo dice "Te enviaremos los datos de pago por correo". Con ellos, dice cómo pagar.
- [ ] **4. En el celular.** El correo se lee bien en el celular: el texto no se corta y el botón se toca fácil.

## Tarea 5.3: el recordatorio y los correos de las citas (celular A, cliente; celular B, dueño)

Con Resend ya configurado en `barberias-dev` por el socio.

- [ ] **1. El recordatorio.**
  1. Reservar desde la página pública una cita para dentro de unas 2 horas, con un correo de Gmail.
  2. El recordatorio llega al instante, a la bandeja de entrada y no a spam, en español, con la barbería, la hora, el barbero y la dirección.
  3. Repetir con Outlook.
- [ ] **2. "Sí, ahí estaré".** Tocarlo en el correo. Abre la cita y pregunta "¿Vas a llegar?". Al tocar el botón dice "Listo, … sabe que vas". En el celular B, la cita muestra "El cliente confirmó que va" y una ✓ en la agenda.
- [ ] **3. "No puedo ir: cancelar".** Desde otro recordatorio, tocarlo. Se abre la hoja para cancelar, y la cita no se cancela hasta tocar "Sí, cancelar mi cita".
- [ ] **4. La barbería cancela o mueve.** En el celular B, mover una cita con correo a otra hora. Al cliente le llega "… cambió la hora de tu cita", con la hora vieja y la nueva. Luego cancelarla: le llega "… canceló tu cita".
- [ ] **5. El aviso al barbero.** Con "Avisos por correo" activado en un barbero que tiene correo, reservar con él. Le llega "Nueva cita: …", y si se cancela, "Cancelaron la cita de …".
- [ ] **6. Agregar al calendario.** Desde el recordatorio, el botón crea el evento en Google Calendar a la hora correcta.

## Tarea 5.5a: solo lectura y avisos en la agenda (celular A, super admin; celular B, dueño)

Con una barbería de prueba que tenga servicios, barberos y una cita para mañana.

- [ ] **1. Por vencer (D-70).** Con el panel de plataforma, extender la prueba hasta dentro de 2 días. En la agenda del dueño sale, en amarillo, "Tu prueba gratis vence el …" con "Paga $25.000 por llave Bre-B 3229381101 o Nequi 3229381101 y envía el comprobante a manuelalejo429@gmail.com".
- [ ] **2. En gracia (D-71).** Con una barbería vencida hace 1 a 5 días, la agenda dice, en rojo, "Tu barbería venció el …" y "Sigues recibiendo reservas hasta el …" (5 días después). La página pública sigue recibiendo reservas.
- [ ] **3. Pausada (D-72).** Suspender la barbería desde el panel de plataforma. La agenda del dueño dice, en gris con un candado, "Tu barbería está pausada", y:
  1. las citas siguen a la vista;
  2. "Nueva cita", reprogramar, cambiar servicios o bloquear horas fallan;
  3. cambiar la comisión en "Cierre del día" muestra "Tu barbería está pausada: …";
  4. una cita que ya empezó sí se puede marcar como atendida o "No asistió";
  5. la página pública no deja reservar, y el cliente sí puede cancelar su cita desde el link de su correo;
  6. el barbero, desde su link, marca atendida pero no bloquea horas.
- [ ] **4. Otra sede sigue normal.** Si el dueño tiene otra sede activa, al cambiar a ella todo funciona.
- [ ] **5. Reactivar.** Registrar un pago a la barbería suspendida: el aviso desaparece (o vuelve el de la prueba) y todo se puede cambiar otra vez.

## Decisiones provisionales de la 5.4 para revisar juntos
Están en `docs/tareas/5.4-panel-plataforma.md`, de P1 a P11.
