# Pruebas humanas de la fase 7
Las mejoras de la revisión del 15 de noviembre de 2026 (`docs/mejoras-revision-2026-11-15.md`). Se hacen todas juntas al final, en `www.yapoin.com`, desde un celular.

Cada tarea agrega aquí su sección. Marca una casilla solo cuando lo viste funcionar.

## Tarea 7.1: lenguaje neutral
Con una cuenta nueva de dueño, de principio a fin.

- [ ] **1. Registro y asistente.** El registro dice "Crea la cuenta de tu establecimiento". El paso del equipo pregunta "¿Quiénes atienden en tu establecimiento?" y ofrece "Yo también atiendo" y "Agregar profesional". La pantalla final dice "¡Tu establecimiento ya recibe citas!".
- [ ] **2. Panel.** En la agenda, en Más y en sus pantallas (Profesionales y horarios, Servicios, Horario, Festivos y cierres, Datos, Compartir) no aparece "barbería", "barbero" ni "cortar".
- [ ] **3. Página pública y reserva.** Desde el link de reservas, reservar una cita completa: los pasos dicen "Profesional", y los avisos hablan de "el establecimiento".
- [ ] **4. Gestionar la cita.** Abrir el link de la cita desde el correo: "Escribir al establecimiento", "Ir al establecimiento".
- [ ] **5. Correos.** El recordatorio de la cita dice "Cuéntale al establecimiento con un toque". Ningún correo dice "barbería" ni "barbero", salvo el nombre propio del negocio.
- [ ] **6. Textos legales.** Los términos y la política dicen "Vigente desde el 15 de noviembre de 2026" y hablan de establecimientos y profesionales.
- [ ] **7. Link corto.** Registrar un negocio con un nombre de dos letras: su link termina en "-citas".
- [ ] **8. Lo que sí debe decir "barbería".** La landing sigue rotando "barbería", "spa", "consultorio", "veterinaria" y "salón", y su demostración sigue siendo "Barbería La Esquina".

## Tarea 7.2: tipo de establecimiento y textos legales
- [ ] **1. El tipo es obligatorio.** En el registro, llenar todo menos "Tipo de establecimiento" y tocar "Crear cuenta": dice "Elige el tipo de establecimiento." y no se pierde lo escrito.
- [ ] **2. "Otro" pide cuál.** Elegir "Otro": aparece "¿Cuál?". Dejarlo vacío no deja crear la cuenta.
- [ ] **3. Volver de los términos.** Con el formulario a medio llenar, abrir "términos de uso" y tocar "Volver": el formulario está igual, con el tipo elegido.
- [ ] **4. Volver de la política, en la reserva.** En el paso de los datos de una reserva, abrir la política de datos y tocar "Volver": los datos y la hora elegida siguen ahí.
- [ ] **5. Abierto directo.** Abrir `www.yapoin.com/terminos` escribiendo la dirección: el botón dice "Volver al inicio".
- [ ] **6. Queda guardado.** En Supabase, la sede nueva tiene el tipo elegido en `business_type` (y el texto en `business_type_other` si fue "Otro").

## Tarea 7.3: asistente
- [ ] **1. Servicios sin oficio.** Con una cuenta nueva, el paso 2 muestra "Servicio 1" y "Servicio 2" con "Toca para completarlo". "Continuar" está apagado y el aviso dice cuáles faltan.
- [ ] **2. Completar uno.** Tocar "Servicio 1": trae el nombre y el precio vacío. Ponerle nombre, precio y duración y guardar: la fila muestra el precio y el aviso solo nombra a "Servicio 2".
- [ ] **3. Desmarcar el otro.** Desmarcar "Servicio 2": "Continuar" se enciende.
- [ ] **4. Formulario vacío.** En el paso 3, agregar un profesional con nombre y correo y guardarlo. Tocar "Agregar profesional" otra vez: el formulario sale vacío.
- [ ] **5. Editar sí trae sus datos.** Tocar el profesional recién creado: el formulario trae su nombre, su correo y sus servicios.

## Tarea 7.4: bloqueos del profesional
Desde el link privado de un profesional.

- [ ] **1. Todo el día.** En "Bloquear horas", marcar "Todo el día": desaparecen "Desde" y "Hasta". Elegir un día sin citas y bloquear: el día queda bloqueado entero, y la página pública no ofrece horas con ese profesional ese día.
- [ ] **2. Día con cita.** Marcar "Todo el día" en un día donde tiene una cita: no deja, y dice que le pida al dueño que la mueva.
- [ ] **3. Festivo cerrado.** En la lista de días, el próximo festivo que el establecimiento no abre sale apagado, con "· cerrado".
- [ ] **4. Día que no trabaja.** Un día en que el profesional no tiene horario sale apagado igual.
- [ ] **5. Cierre del establecimiento.** El dueño cierra el establecimiento un día entero en Festivos y cierres. Ese día sale apagado para el profesional.
- [ ] **6. Quitar.** El bloqueo de todo el día se puede quitar desde la agenda del profesional.

## Tarea 7.5: aviso al profesional, con WhatsApp
Con la función de correos desplegada, y un profesional con correo y avisos activados.

- [ ] **1. El correo.** Reservar una cita con ese profesional dejando un celular. En menos de dos minutos le llega "Nueva cita: …", con la duración, el total y el botón "Escribirle a … por WhatsApp".
- [ ] **2. El botón.** Tocarlo abre WhatsApp en el chat con el celular que dejó el cliente.
- [ ] **3. Sin celular.** Reservar otra cita sin celular: el correo llega sin botón.
- [ ] **4. El dueño.** En el detalle de esa cita y en la ficha del cliente, "Escribirle por WhatsApp" abre el mismo chat. En la cita sin celular no aparece.
- [ ] **5. El cliente no recibe el celular de nadie.** El recordatorio que le llega al cliente no trae ningún número.

## Tarea 7.10: servicios tocables en la página pública
Desde el celular de un cliente, sin sesión, con un establecimiento de prueba que tenga al menos dos servicios y dos profesionales.

- [ ] **1. Tocar un servicio.** Abrir `www.yapoin.com/<link>` y tocar un servicio de la lista. Debe abrir el paso del profesional con ese servicio ya elegido: la línea de arriba nombra ese servicio.
- [ ] **2. Sumar otro servicio.** Desde el paso del profesional, volver a "Servicios": el servicio tocado está marcado. Marcar otro y continuar. La reserva sigue con los dos.
- [ ] **3. Terminar la reserva.** Elegir profesional, día y hora, llenar los datos y confirmar. La cita sale en la agenda del dueño con el servicio tocado.
- [ ] **4. "Reservar cita" no cambió.** En la página, tocar "Reservar cita": abre "Servicios" sin nada elegido.
- [ ] **5. Se ve que se toca.** Al tocar una fila, la fila responde enseguida. En iPhone y en Android, la flecha de la derecha se ve en cada servicio y el texto no se corta con nombres largos.

## Tarea 7.5: el celular es obligatorio al reservar
- [ ] **1. Sin celular no reserva.** En el paso de los datos, dejar el celular vacío y confirmar: dice "Escribe tu celular." y lo demás no se pierde.
- [ ] **2. Con celular.** Reservar con un celular: la cita queda, y en su detalle el dueño tiene "Escribirle por WhatsApp".
- [ ] **3. La cita manual no lo exige.** Desde el panel, el dueño crea una cita sin celular.

## Tarea 7.3b: ubicación obligatoria
Con una cuenta nueva, desde un celular, parado en el local.

- [ ] **1. El paso nuevo.** Después de los servicios aparece "Tu ubicación" (paso 3 de 4). Sin marcarla, "Continuar" dice "Marca tu ubicación para continuar."
- [ ] **2. Marcar.** Tocar "Usar mi ubicación actual" y dar permiso: aparece el mapa con el punto en el local. "Continuar" lleva al equipo.
- [ ] **3. Sin permiso.** Negar el permiso de ubicación: el mensaje dice cómo activarlo, y no deja continuar.
- [ ] **4. El cliente ve el mapa.** Terminar el asistente y abrir el link de reservas: la página muestra el mapa y "Cómo llegar".
- [ ] **5. No se quita.** En Más › Datos ya no aparece "Quitar ubicación". Tocar "Usar mi ubicación actual" desde otro lugar y guardar: el punto cambia.
- [ ] **6. iPhone y Android.** Repetir los pasos 2 y 3 en los dos.

## Tarea 7.12: panel de plataforma en computador
En un computador (pantalla de 1024 px de ancho o más), con la cuenta del super admin.

- [ ] **1. El menú.** Al entrar a `www.yapoin.com/admin` hay un menú a la izquierda con "Establecimientos" y "Métricas", y "Cerrar sesión" al final. El que está abierto se ve resaltado.
- [ ] **2. La tabla.** La lista sale como tabla: establecimiento (con su tipo y su link), dueño y correo, ciudad, estado, vence y registro.
- [ ] **3. Ordenar.** Tocar "Vence": los que vencen primero quedan arriba. Tocar otra vez: al revés. Recargar la página: el orden se mantiene. Lo mismo con "Estado": los vencidos y suspendidos quedan arriba.
- [ ] **4. Buscar y filtrar con orden.** Con un orden puesto, buscar por el correo de un dueño y tocar un filtro: el orden se conserva.
- [ ] **5. La ficha.** Tocar un establecimiento: la ficha sale en dos columnas, con los pagos a la izquierda y "Registrar pago" a la derecha. Registrar un pago y anularlo funciona como antes.
- [ ] **6. Métricas.** Tocar "Métricas": salen las tarjetas, los tres gráficos y la tabla por tipo. Pasar el mouse por una barra muestra su valor arriba. "Ver tabla" muestra los números de cada semana o mes.
- [ ] **7. Los números cuadran.** El ingreso de este mes en el gráfico es igual al de la tarjeta "Ingreso del mes". Un establecimiento nuevo creado hoy suma 1 a la última barra de "Registros por semana" y a su tipo en la tabla.
- [ ] **8. En el celular no cambió.** Abrir `/admin` desde el celular: se ve la lista de siempre, sin menú lateral, con el ícono de métricas arriba.

## Tarea 7.8a: prueba de 30 días, planes y límite de profesionales
Con dos correos nuevos y el celular, y la cuenta del super admin en un computador.

- [ ] **1. Precios.** En `www.yapoin.com`, tocar "Precios": el plan 1 dice $25.000 tachado y $0 el primer mes; el plan 2, $40.000 tachado y $25.000 el primer mes. "Por acuerdo" abre WhatsApp con un mensaje listo.
- [ ] **2. Plan 1.** Tocar el plan 1: el registro lo trae elegido y dice 30 días gratis. Registrarse, confirmar y terminar el asistente: la pantalla final y Más dicen que la prueba termina 30 días después de hoy.
- [ ] **3. Plan 2.** Con otro correo, tocar el plan 2 en Precios: el registro lo trae elegido y explica que recibe citas desde el primer pago. Registrarse y terminar el asistente: la pantalla final no habla de prueba. En la agenda sale el aviso del primer pago, con $25.000. La página pública no deja reservar.
- [ ] **4. Días gratis al plan 2.** Desde el admin, en la ficha de ese establecimiento, "Extender prueba" unos días: su página ya deja reservar.
- [ ] **5. Primer pago del plan 2.** En otra cuenta de plan 2, "Registrar pago": el valor es $25.000. Registrarlo: la página deja reservar. El siguiente pago ya es de $40.000.
- [ ] **6. El límite.** En la cuenta del plan 1, con 4 profesionales activos (contándote si atiendes), crear un quinto en Más › Profesionales: no deja y explica el límite. Desactivar uno y crear el nuevo: sí deja. Volver a activar el desactivado: no deja.
- [ ] **7. "Crear cuenta gratis".** Desde la landing, "Crear cuenta gratis" lleva al registro con el plan 1 elegido, y se puede cambiar al plan 2 antes de enviar.
- [ ] **8. Términos.** Los términos dicen "Vigente desde el 16 de noviembre de 2026", los 30 días del plan 1 y que el plan 2 no tiene prueba.

## Tarea 7.6b: cuentas de profesional, invitación y "Mi agenda"
Con la plantilla `invite.html` pegada en Supabase (Emails › Invite user), una cuenta de dueño y un profesional con un correo tuyo. Desde dos celulares: el del dueño y el del profesional.

- [ ] **1. Sin correo.** En la ficha de un profesional sin correo, "Acceso a su agenda" dice "Sin correo" y no hay botón de invitar.
- [ ] **2. Invitar.** Escribir el correo, guardar y volver a la ficha: dice "Sin invitar". Tocar "Invitar": dice "Listo, le enviamos la invitación" y luego "Invitación enviada", con la fecha y hora hasta la que sirve el link.
- [ ] **3. Correo sin guardar.** Cambiar el correo sin guardar: en vez del botón dice que guardes primero.
- [ ] **4. El correo.** Al profesional le llega "Te invitaron a ver tu agenda en Yapoin", en español, con el nombre del establecimiento y el botón "Crear mi contraseña".
- [ ] **5. Un toque.** El botón abre "Ya casi" con "Continuar". Sin tocarlo no pasa nada (los lectores de correo no gastan el link).
- [ ] **6. Contraseña y términos.** Tras "Continuar" sale "Crea tu contraseña" con su nombre. Sin marcar la casilla de los términos no deja seguir. Con la casilla, entra a "Mi agenda".
- [ ] **7. Queda guardado.** En Supabase, el perfil del profesional tiene `terms_version` y `terms_accepted_at`.
- [ ] **8. Mi agenda.** Ve sus citas del día y de la semana, sin precios ni otros profesionales. Marca una cita que ya empezó y bloquea una hora. "Cerrar sesión" lo saca.
- [ ] **9. WhatsApp.** En el detalle de una cita con celular sale "Escribirle por WhatsApp" y abre el chat. En una sin celular no sale.
- [ ] **10. Compartir.** "Compartir mi link de reservas" abre el menú del celular (o copia el link). Abrir ese link: tras elegir los servicios va directo a la hora, con él elegido. Si eliges un servicio que él no hace, pide elegir profesional.
- [ ] **11. Ingreso normal.** Cerrar sesión e ingresar por `/ingresar` con su correo y contraseña: llega a "Mi agenda".
- [ ] **12. No entra al panel.** Con la sesión del profesional, abrir `/panel` y `/admin`: vuelve a "Mi agenda". Con la del dueño, abrir `/mi-agenda`: vuelve al panel.
- [ ] **13. Link vencido.** Abrir otra vez el link del correo ya usado: dice "Esa invitación venció o ya se usó", y que si ya la abrió pida un link en "¿Olvidaste tu contraseña?".
- [ ] **13b. Abrió y no puso contraseña.** Con otro profesional: abrir la invitación, no crear la contraseña y volver después de una hora a `/nueva-clave`: lo manda a pedir un link nuevo. Pedirlo en "¿Olvidaste tu contraseña?": el link lleva a crear la contraseña con la casilla de los términos, y entra a su agenda.
- [ ] **14. Reenviar.** Con una invitación sin abrir, tocar "Reenviar invitación": llega otro correo, y el link nuevo funciona.
- [ ] **15. Correo ocupado.** Invitar a un profesional con el correo del dueño: dice que ese correo ya tiene cuenta, sin decir de quién.
- [ ] **16. Quitar acceso.** Tocar "Quitar acceso", confirmar: dice "Acceso quitado". En el celular del profesional, recargar: vuelve a ingresar y su contraseña ya no sirve.
- [ ] **17. Volver a invitar.** Tocar "Invitar" con el mismo correo: llega una invitación nueva y funciona.
- [ ] **18. El link privado sigue igual.** El link `/b/…` de otro profesional sigue mostrando su agenda, sin WhatsApp (se quita en la 7.6c).

## Tarea 7.6c: eliminar un profesional y quitar el link privado
Con la cuenta de dueño y dos profesionales con cuenta (de la 7.6b). Desde dos celulares: el del dueño y el de un profesional.

- [ ] **1. La lista dice el acceso.** En Más › Profesionales, cada profesional dice al final "sin correo", "sin invitar", "invitado", "invitación vencida", "con acceso" o "sin acceso". El dueño que atiende no dice nada de eso. Ya no aparece "link" en la lista.
- [ ] **2. La ficha sin link.** En la ficha ya no está la fila "Link privado". El texto del correo dice que sirve para invitarlo.
- [ ] **3. Dirección vieja de la ficha.** Abrir `/panel/profesionales/<id>/link` (cambia `<id>` por el de un profesional): abre su ficha.
- [ ] **4. Link viejo del profesional.** Abrir `www.yapoin.com/b/cualquier-cosa`: dice "Este link ya no funciona", que ahora entra con su cuenta, y el botón "Ingresar" lleva a `/ingresar`.
- [ ] **5. Textos.** La agenda vacía dice "Invita a tus profesionales a ver su agenda". El paso "Tu equipo" del asistente dice que después los invitas desde Más › Profesionales. Nada habla de un link privado.
- [ ] **6. No se elimina con citas por venir.** A un profesional con una cita mañana, tocar "Eliminar a …": la hoja dice cuántas citas tiene y que las pases o canceles; no hay botón para eliminar.
- [ ] **7. Qué se borra y qué queda.** Cancelar o mover esa cita y volver a "Eliminar a …": la hoja dice qué se borra (nombre, correo, foto, cuenta, servicios, horario, bloqueos por venir) y qué queda (citas pasadas, cierre, historial). "Cancelar" no hace nada.
- [ ] **8. Eliminar.** Tocar "Sí, eliminar": vuelve a Profesionales y ya no está. Más cuenta un profesional activo menos.
- [ ] **9. Su sesión termina.** En el celular del profesional eliminado, recargar "Mi agenda": lo manda a ingresar, y su contraseña ya no sirve.
- [ ] **10. Su foto.** Si tenía foto, en Supabase › Storage ya no está el archivo.
- [ ] **11. El historial cuadra.** En la agenda de un día pasado donde tenía citas, salen a nombre de "Profesional eliminado". El cierre de ese día da los mismos totales que antes. En Clientes, las visitas del cliente siguen contando.
- [ ] **12. No aparece donde no debe.** La página de reservas, "Nueva cita" del dueño y la agenda de mañana no lo muestran.
- [ ] **13. El plan.** Con el plan 1 lleno (4 activos), eliminar a uno y agregar otro: deja. El eliminado no cuenta.
- [ ] **14. El dueño no se elimina.** En la ficha del dueño que atiende no está "Eliminar".
- [ ] **15. Pausado.** Con el establecimiento pausado, eliminar a un profesional sin citas por venir también funciona.
