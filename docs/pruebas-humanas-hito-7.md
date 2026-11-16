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
