# Pruebas humanas de la fase 8
Las tareas 11 a 15 que pasó el socio el 17 de noviembre de 2026. Se hacen todas juntas al final, en `www.yapoin.com`, desde un celular.

Cada tarea llena su sección. Marca una casilla solo cuando lo viste funcionar.

## Tarea 8.15: intervalo de 5 y 10 minutos
Con una cuenta de dueño y el celular de un cliente, sin sesión.

- [ ] **1. Las opciones.** En Más › Reservas y cancelaciones, "Cada cuánto ofreces las horas" trae, en este orden: cada 5 minutos, cada 10 minutos, cada 15 minutos, cada 30 minutos y cada hora. Sin tocar nada sigue en 15.
- [ ] **2. Cada 10 minutos.** Elegir "Cada 10 minutos" y guardar. En la página de reservas, un día abierto ofrece 10:00, 10:10, 10:20… y nunca 10:05 ni 10:15.
- [ ] **3. Cada 5 minutos.** Elegir "Cada 5 minutos": salen las horas de 5 en 5 (10:00, 10:05, 10:10…). La lista carga igual de rápido que con 15.
- [ ] **4. Reservar.** Con "Cada 5 minutos", reservar a las 10:05: la cita queda a esa hora en la agenda del dueño.
- [ ] **5. Cambiar mi cita.** Desde el link del correo de esa cita, "Cambiar" ofrece las horas de 5 en 5.

## Tarea 8.12: avisos siempre encendidos
Con una cuenta de dueño y el correo de un profesional que puedas abrir.

- [ ] **1. Sin casilla.** En Más › Profesionales y horarios › "Agregar profesional", el formulario ya no tiene la casilla "Avisos por correo". La ayuda del correo dice que a ese correo le llegan los avisos de sus citas y la invitación.
- [ ] **2. Le llegan los avisos.** Agregar un profesional con correo, sin tocar nada más. Reservar una cita con él desde la página de reservas: a su correo llega el aviso de la reserva.
- [ ] **3. Y los de cancelación.** Cancelar esa cita desde el link del cliente: al profesional le llega el aviso.
- [ ] **4. Sin correo no hay avisos.** Quitarle el correo y guardar: se guarda sin error, y una reserva nueva con él no le manda nada.
- [ ] **5. Los que ya existían.** Un profesional que antes tenía los avisos apagados y tiene correo ahora los recibe.

## Tarea 8.13: compartir desde el panel del profesional
Con la cuenta de un profesional (invitado por el dueño) y un segundo celular o una ventana de incógnito.

- [ ] **1. El botón.** En "Mi agenda" aparece "Compartir mi link de reservas". Al tocarlo, el celular abre la hoja de compartir (WhatsApp, Instagram…), con el texto "Reserva tu cita conmigo en …".
- [ ] **2. El link reserva con ese profesional.** Abrir el link en el otro celular, sin sesión: pide los servicios y pasa directo a la hora, sin preguntar "¿Con quién?". Al confirmar, la cita queda con ese profesional y le aparece en "Mi agenda".
- [ ] **3. En el computador copia el link.** Desde un computador, el botón dice que copió el link, y al pegarlo es el mismo.
- [ ] **4. Un profesional que ya no atiende.** El dueño desactiva al profesional. El link viejo deja elegir a otra persona, sin error.

## Tarea 8.14: bloquear mi agenda
Con una cuenta de dueño que también atiende (en el asistente, "Yo también atiendo"), un profesional más (Ana) y el celular de un cliente, sin sesión.

- [ ] **1. Las tres opciones.** En la agenda, "Bloquear horas": arriba "¿Qué quieres bloquear?" con Mi agenda (marcada), Un profesional y Todo el establecimiento, cada una con su línea de ayuda. El botón dice "Bloquear mi agenda".
- [ ] **2. Cambia el botón.** Tocar "Un profesional": aparece el selector con Ana y el botón dice "Bloquear a Ana". Tocar "Todo el establecimiento": el selector se va y el botón dice "Bloquear el establecimiento".
- [ ] **3. Mi agenda, todo el día.** Volver a Mi agenda, elegir mañana, marcar "Todo el día" (Desde y Hasta desaparecen), motivo Diligencia y "Bloquear mi agenda". Vuelve a la agenda de mañana con el bloqueo solo en la columna del dueño.
- [ ] **4. La página pública.** Desde el celular del cliente: con el dueño, mañana sale "sin horas libres"; con Ana, mañana ofrece horas.
- [ ] **5. Lo ya cerrado.** En Horario › Festivos y cierres, agregar un cierre de un día entero (pasado mañana). En "Bloquear horas", ese día sale apagado con "· cerrado" en las tres opciones.
- [ ] **6. Fuera de horario.** Con Mi agenda, elegir una hora en que el dueño no trabaja (por ejemplo, las 11:00 p. m.) y bloquear: sale "Ese horario ya está cerrado: no hace falta bloquearlo."
- [ ] **7. Todo el establecimiento.** Elegir "Todo el establecimiento", un día abierto, de 1:00 a 2:00 p. m., y "Bloquear el establecimiento". En la agenda el bloqueo sale en todas las columnas; con motivo, se lee "Cerrado · motivo".
- [ ] **8. Con una cita en medio.** Crear una cita con Ana y luego, con "Un profesional" y Ana, intentar bloquear esa hora: sale el aviso con el nombre del cliente y el botón queda apagado.
- [ ] **9. Un dueño que no atiende.** En una cuenta de dueño que no atiende, "Bloquear horas" no trae "Mi agenda": empieza en "Un profesional".

## Tarea 8.11: invitación del profesional
Antes: la plantilla "Invite user" pegada en Supabase (`docs/tareas/8.11-invitacion.md`). Con una cuenta de dueño y un correo que puedas abrir y que nunca haya tenido cuenta en Yapoin.

- [ ] **1. El correo es el nuestro.** Invitar a un profesional desde su ficha. El correo llega en español, con el botón "Crear mi contraseña" y el encabezado de Yapoin.
- [ ] **2. No lleva a la landing.** Al tocar el botón del correo se abre "Te invitaron a ser parte de un equipo", con un solo botón: "Crear mi contraseña".
- [ ] **3. Dice quién invita.** Al tocarlo, la pantalla dice "{tu establecimiento} te ha invitado a ser parte de su equipo" y pide la contraseña y aceptar los términos.
- [ ] **4. Queda como profesional.** Al guardar entra a "Mi agenda" de ese establecimiento. En la ficha del dueño, su acceso aparece activo.
- [ ] **5. El link ya usado.** Abrir de nuevo el link del correo: dice que la invitación venció o ya se usó, y cómo entrar.
- [ ] **6. Un correo que ya tiene cuenta.** Invitar a un correo que ya es dueño en Yapoin: el dueño ve "Ese correo ya tiene una cuenta en Yapoin o una invitación pendiente", y a ese correo no le llega nada.
- [ ] **7. Solo por invitación.** Registrarse en `/registro` con un correo nuevo crea un establecimiento propio, nunca un profesional de otro.

## Tarea 8.16: la invitación sale al guardar
Con una cuenta de dueño y dos correos que puedas abrir y que nunca hayan tenido cuenta en Yapoin.

- [ ] **1. Nuevo con correo.** Más › Profesionales › Agregar profesional, con nombre, servicios y el primer correo. Al guardar, la lista muestra arriba "Le enviamos la invitación a {ese correo}" y el profesional sale como "invitado". El correo llega con "Crear mi contraseña", sin tocar "Invitar".
- [ ] **2. Sin correo, no se envía.** Agregar otro profesional sin correo: se guarda y no sale ningún aviso de invitación.
- [ ] **3. Ponerle correo después.** Abrir ese profesional, escribir el segundo correo y guardar: sale el mismo aviso y le llega el correo. Guardar de nuevo sin cambiar el correo no envía nada más.
- [ ] **4. Un correo que ya tiene cuenta.** Agregar un profesional con el correo del dueño: se guarda y la lista dice "Guardamos a {nombre}, pero no pudimos enviarle la invitación. Ese correo ya tiene una cuenta en Yapoin o una invitación pendiente. Usa otro correo." Sin decir de quién es.
- [ ] **5. Lo de siempre sigue.** En la ficha del profesional invitado, "Reenviar invitación" y "Quitar acceso" funcionan como antes, y el texto bajo "Correo" dice que la invitación sale al guardar.
