# Especificación MVP — Agendamiento para barberías

Nov 2, 2026 · @Alejandro

## Visión y alcance

El MVP es una web app que permite a los clientes de una barbería reservar su cita desde un link, y a la barbería manejar su agenda y sus barberos desde el celular. Se construye en 6 semanas, sin pasarela de pagos, y se activa manualmente cuando el dueño paga por transferencia.

**Propuesta de valor para la barbería:** menos mensajes de WhatsApp contestando horarios, menos clientes que no llegan, y la agenda de todos los barberos en un solo lugar.

**Propuesta de valor para el cliente final:** reservar a cualquier hora en menos de un minuto, sin descargar ninguna app y sin crear contraseña.

**Principios del producto:**

- Configurable en 10 minutos desde el celular, sin capacitación.
- Todo funciona en el navegador del celular; nada se descarga de una tienda de apps.
- En pesos colombianos, en español de Colombia y con hora de Colombia (UTC-5) fija.
- Cada función debe resolver un dolor que ya resuelven los competidores; nada experimental.

## Usuarios y roles

Cada barbería tiene una sola cuenta, la del dueño; los barberos no necesitan cuenta y ven su agenda desde un link privado. El cliente final tampoco crea cuenta.

| Rol | Quién es | Dónde entra | Cómo se identifica |
| --- | --- | --- | --- |
| Super admin | Tú y tu equipo | Panel de plataforma | Correo y contraseña |
| Dueño | Quien paga la suscripción y administra la barbería | Panel de barbería completo | Correo y contraseña; recupera acceso por correo |
| Barbero | Empleado de la barbería | Vista "Mi agenda" | Link privado y secreto, sin cuenta ni contraseña |
| Cliente final | Quien se corta el pelo | Página pública de reservas | Nombre y celular, sin contraseña |

**Link privado del barbero:** el sistema lo genera al crear al barbero y el dueño se lo envía por WhatsApp con un toque. Con él, el barbero ve solo su agenda del día y la semana, marca citas como atendidas o no asistió y bloquea sus horas. No ve precios totales, reportes, otros barberos ni la configuración. Si el barbero se va, el dueño desactiva el link y deja de funcionar al instante.

**Avisos al barbero (opcional):** si el dueño registra el celular del barbero, este recibe por WhatsApp cada nueva reserva o cancelación, sin entrar a ninguna parte.

**Fase 2, plan Pro:** cuentas propias por barbero con roles (administrador, recepcionista), para barberías establecidas que necesitan que otra persona maneje la agenda de todos.

**Dueño que también corta:** el dueño puede crearse a sí mismo como barbero; su agenda aparece junto a las demás en el panel.

## Funcionalidades del MVP

Son 24 funciones: P1 es imprescindible para lanzar, P2 entra si cabe en las 6 semanas y si no pasa al primer mes después del lanzamiento.

| # | Función | Rol | Prioridad |  |
| --- | --- | --- | --- | --- |
| 1 | Página pública de la barbería con link propio (logo, dirección, mapa, horario) | Cliente | P1 |  |
| 2 | Reservar: servicio → barbero (o "cualquiera") → día → hora → nombre y celular | Cliente | P1 |  |
| 3 | Confirmación en pantalla + botón "Agregar a mi calendario" | Cliente | P1 |  |
| 4 | Link para cancelar o reprogramar la cita sin llamar | Cliente | P1 |  |
| 5 | Recordatorio de la cita (ver sección Notificaciones) | Cliente | P1 |  |
| 6 | Ver "mis citas" ingresando el celular + código | Cliente | P2 |  |
| 7 | Registro de la barbería en 3 pasos con prueba gratis de 14 días | Dueño | P1 |  |
| 8 | Crear servicios: nombre, precio en COP, duración | Dueño | P1 |  |
| 9 | Crear barberos (sin cuenta), asignarles servicios y horario, y enviarles su link privado | Dueño | P1 |  |
| 10 | Horario de la barbería, días festivos de Colombia y cierres especiales | Dueño | P1 |  |
| 11 | Agenda del día y de la semana, por barbero o todos | Dueño; barbero por link | P1 |  |
| 12 | Crear cita manual (cliente que llamó o llegó sin cita) | Dueño | P1 |  |
| 13 | Bloquear horas (almuerzo, permiso, diligencia) | Dueño; barbero por link | P1 |  |
| 14 | Marcar cita: atendida, no asistió, cancelada | Dueño; barbero por link | P1 |  |
| 15 | Lista de clientes con historial de visitas e inasistencias | Dueño | P1 |  |
| 16 | Datos de abono opcional (Nequi, Daviplata o llave Bre-B) y marcar "abono recibido" | Dueño | P2 |  |
| 17 | Cierre del día: servicios atendidos, total y comisión por barbero | Dueño | P2 |  |
| 18 | Botón para compartir el link en WhatsApp e Instagram + código QR para imprimir | Dueño | P1 |  |
| 19 | Aviso de pago y estado de la suscripción dentro del panel | Dueño | P1 |  |
| 20 | Lista de barberías con plan, estado y fecha de vencimiento | Super admin | P1 |  |
| 21 | Botón "Registrar pago y activar hasta" | Super admin | P1 |  |
| 22 | Suspender, reactivar y extender prueba | Super admin | P1 |  |
| 23 | Historial de pagos por barbería | Super admin | P1 |  |
| 24 | Métricas básicas: barberías activas, en prueba, vencidas, ingreso mensual | Super admin | P2 |  |

## Flujos principales

Hay tres flujos que deben funcionar perfecto el día del lanzamiento: la reserva del cliente, el registro de la barbería y el cobro con activación.

**1. Reserva del cliente**

&#91;embedded content: flujo de reserva del cliente · 5 pasos, 1 validación\]

La hora se vuelve a validar al confirmar, porque dos clientes pueden estar mirando el mismo espacio; el barbero recibe aviso de cada reserva y cancelación.

**2. Registro de la barbería (meta: menos de 10 minutos)**

1. El dueño entra desde un link de venta o anuncio y escribe el nombre de la barbería, su celular, su correo y una contraseña.
2. Agrega sus servicios con precio y duración (el sistema sugiere los típicos: corte, barba, corte + barba, cejas, niños).
3. Agrega sus barberos con nombre, foto opcional y horario; puede usar el horario de la barbería para todos. El sistema genera el link privado de cada barbero.
4. Recibe su link y QR listos para compartir; empieza la prueba de 14 días.

**3. Cobro y activación**

1. El sistema avisa al dueño antes de vencer, con el valor y tus datos de pago.
2. El dueño transfiere y envía el comprobante a tu WhatsApp.
3. Revisas que el dinero llegó a tu cuenta.
4. En el panel de plataforma registras el pago; la barbería queda activa hasta la nueva fecha y el dueño recibe confirmación.

## Pantallas

Son 22 pantallas en tres aplicaciones; todas se diseñan primero para celular.

**Página pública de reservas** (`tuapp.co/nombre-barberia`)

1. Perfil de la barbería: logo, foto, dirección con mapa, horario, botón "Reservar".
2. Elegir servicio: lista con precio y duración.
3. Elegir barbero: foto y nombre, o "El primero disponible".
4. Elegir día y hora: calendario de los próximos 30 días y horas libres.
5. Datos del cliente: nombre y celular; si ya reservó antes, se autocompleta.
6. Confirmación: resumen, dirección, agregar al calendario, datos de abono si aplica.
7. Gestionar mi cita (desde el link del mensaje): ver, cancelar o reprogramar.

**Panel de la barbería**

1. Ingreso: correo y contraseña, con recuperación por correo.
2. Registro y asistente inicial: datos de la barbería → servicios → barberos y horarios.
3. Agenda: vista día (columnas por barbero) y semana; tocar un espacio crea cita.
4. Detalle de cita: cliente, servicio, estado, botón de WhatsApp al cliente.
5. Nueva cita manual.
6. Bloquear horas.
7. Clientes: lista, búsqueda y ficha con historial.
8. Servicios.
9. Barberos y horarios.
10. Configuración: datos, logo, horario, festivos, política de cancelación, datos de abono.
11. Compartir: link, QR descargable, texto listo para estados de WhatsApp.
12. Mi suscripción: plan, vence el, datos para pagar, historial de pagos.
13. Cierre del día (P2).

**Vista del barbero** (link privado, sin cuenta)

1. Mi agenda: citas del día y la semana, marcar atendida o no asistió, bloquear horas.

**Panel de plataforma (super admin)**

1. Lista de barberías con filtros: en prueba, activa, por vencer, vencida, suspendida.
2. Ficha de barbería: datos del dueño, uso, historial de pagos, botón "Registrar pago".

## Reglas de negocio

La regla central: una hora está libre solo si el barbero trabaja ese día, la barbería está abierta, no hay bloqueo y no choca con otra cita activa.

**Disponibilidad**

- Los espacios se ofrecen cada 15 minutos; la duración la pone el servicio (ej. corte 40 min, corte + barba 60 min).
- Anticipación mínima configurable (por defecto 1 hora) y máxima de 30 días.
- "El primero disponible" asigna al barbero libre con menos citas ese día.
- Al confirmar se vuelve a validar el espacio en la base de datos, para que dos clientes no tomen la misma hora.
- Festivos de Colombia precargados; la barbería decide si abre.

**Cancelación y reprogramación**

- El cliente puede cancelar o reprogramar hasta X horas antes (por defecto 2), desde el link de su mensaje.
- La barbería puede cancelar siempre; el sistema avisa al cliente.

**Inasistencias**

- La barbería marca "no asistió"; el sistema lleva el conteo por cliente.
- Con 2 o más inasistencias, la ficha del cliente muestra una alerta; la barbería decide si le pide abono.

**Estados de una cita**

| Estado | Quién lo pone | Ocupa el espacio |
| --- | --- | --- |
| Confirmada | Sistema al reservar | Sí |
| Atendida | Barbero o dueño | Sí |
| No asistió | Barbero o dueño | Sí |
| Cancelada por cliente | Cliente | No |
| Cancelada por barbería | Barbero o dueño | No |

## Suscripciones y activación manual

No hay pasarela: la barbería paga por transferencia, Nequi o llave Bre-B, envía el comprobante por WhatsApp y tú registras el pago en el panel, lo que extiende su fecha de vencimiento.

**Planes propuestos (a validar con los pilotos)**

| Plan | Barberos | Precio mensual | Trimestral | Anual |
| --- | --- | --- | --- | --- |
| Básico | Hasta 3 | $39.900 COP | $107.700 COP (10% dto.) | $399.000 COP (2 meses gratis) |
| Pro | Hasta 8 | $69.900 COP | $188.700 COP (10% dto.) | $699.000 COP (2 meses gratis) |

Ambos planes incluyen todas las funciones del MVP y links privados para los barberos. Cuando lleguen las cuentas por barbero con roles (fase 2), serán exclusivas del Pro.

**Ciclo de la suscripción**

1. Registro: empieza la prueba gratis de 14 días con todo habilitado.
2. Avisos automáticos al dueño: 3 días antes de vencer, el día del vencimiento y 3 días después, con tus datos de pago y el valor exacto.
3. Pago: el dueño transfiere y envía el comprobante a tu WhatsApp.
4. Activación: en el panel eliges la barbería, el plan y el periodo, escribes la referencia del comprobante y guardas; el sistema calcula la nueva fecha de vencimiento.
5. Gracia: 5 días después de vencer, la barbería sigue funcionando con un aviso rojo en el panel.
6. Suspensión: pasados los 5 días, la página pública deja de recibir reservas nuevas (muestra el WhatsApp de la barbería) y el panel queda en solo lectura. Las citas ya tomadas se respetan y no se borra ningún dato.
7. Reactivación: al registrar un pago, todo vuelve a funcionar al instante.

**Regla de fechas:** si paga antes de vencer, el nuevo periodo se suma a la fecha de vencimiento; si paga ya vencido, se cuenta desde el día del pago.

## Notificaciones y WhatsApp

Los recordatorios salen por WhatsApp usando la API oficial de Meta (Cloud API) desde un solo número de la plataforma, y cuestan casi nada: la tarifa de mensajes de utilidad en Colombia era de unos US$0,0008 por mensaje con la lista de precios de abril de 2026 ([fuente](https://formbeep.pages.dev/whatsapp-api-pricing/)). Meta actualiza tarifas cada trimestre, así que hay que revisarla en su página oficial antes de lanzar ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).

**Costo estimado por barbería:** 300 citas al mes × 2 mensajes = 600 mensajes ≈ US$0,48 al mes, unos $2.000 COP. Es menos del 5% del plan Básico.

**Mensajes del MVP (plantillas de utilidad, aprobadas por Meta)**

| Mensaje | Para | Cuándo |
| --- | --- | --- |
| Cita confirmada + link para gestionarla | Cliente | Al reservar |
| Recordatorio con botones "Confirmo" / "Cancelar" | Cliente | 24 h antes (o 3 h si la cita es para el mismo día) |
| Cita cancelada o reprogramada | Cliente | Cuando la barbería cambia la cita |
| Nueva reserva o cancelación (opcional) | Barbero | Al instante |
| Link privado de su agenda (sale del WhatsApp del dueño con un toque) | Barbero | Al crear al barbero |
| Suscripción por vencer, vencida, suspendida, pago registrado | Dueño | Según el ciclo de suscripción |

**Sin empresa formal sí se puede.** La API de Meta funciona sin verificar el negocio, con un límite de 250 destinatarios distintos cada 24 horas y hasta 2 números ([fuente](https://blueticks.co/blog/whatsapp-api-without-meta-verification)). Solo se necesita una cuenta de Meta Business, un número dedicado y la aprobación de cada plantilla. Como cada barbería genera unos 20 destinatarios al día, ese límite alcanza para el piloto de 10 barberías, pero no para crecer.

**Para escalar hay que verificar el negocio**, con documentos que prueben nombre legal y dirección; con RUT y Cámara de Comercio es lo más fluido. El RUT como persona natural es gratis en la DIAN, así que el plan es sacarlo durante el piloto, intentar la verificación con él y, si Meta lo pide, registrar la matrícula mercantil antes de abrir la venta. No usar servicios no oficiales que conectan un WhatsApp normal: violan las reglas de WhatsApp y el número puede ser bloqueado.

**Los ingresos ya no dependen de WhatsApp:** dueño y super admin entran con correo y contraseña, gratis. WhatsApp queda solo para confirmaciones y recordatorios a clientes y avisos opcionales a barberos.

**Plan B mientras Meta aprueba:** correo electrónico para confirmaciones y un botón en el panel que abre WhatsApp con el mensaje ya escrito (`wa.me`), para que el barbero lo envíe desde su propio celular con un toque.

## Modelo de datos

Son 11 tablas; todas las de negocio llevan `barberia_id` para separar los datos de cada barbería (multi-tenant con seguridad a nivel de fila).

| Tabla | Campos principales | Relación |
| --- | --- | --- |
| `barberias` | nombre, slug (para el link), logo, dirección, lat/lng, whatsapp, horario semanal, anticipación mín., horas para cancelar, datos de abono, estado\_suscripcion, plan, vence\_el | Raíz de todo |
| `usuarios` | nombre, celular, correo, rol (dueño o super\_admin), activo | Pertenece a una barbería (salvo super admin) |
| `barberos` | nombre visible, foto, celular, token\_link (link privado), link\_activo, avisos\_whatsapp, orden, activo | Pertenece a una barbería |
| `horarios_barbero` | barbero\_id, día de la semana, hora\_inicio, hora\_fin | Varios por barbero |
| `servicios` | nombre, precio\_cop, duracion\_min, activo | Pertenece a una barbería |
| `barbero_servicio` | barbero\_id, servicio\_id | Qué servicios hace cada barbero |
| `bloqueos` | barbero\_id (o toda la barbería), inicio, fin, motivo | Vacaciones, almuerzo, festivos |
| `clientes` | nombre, celular (único por barbería), visitas, inasistencias, notas | Pertenece a una barbería |
| `citas` | cliente\_id, barbero\_id, servicio\_id, inicio, fin, precio\_cop, estado, origen (web o manual), abono\_recibido, token\_gestion | El corazón del sistema |
| `notificaciones` | cita\_id o barberia\_id, tipo, canal, programada\_para, enviada\_el, estado | Cola de mensajes |
| `pagos_suscripcion` | barberia\_id, plan, periodo, valor\_cop, medio, referencia, fecha\_pago, cubre\_desde, cubre\_hasta, registrado\_por | Historial de cobros |

Todas las fechas se guardan en UTC y se muestran en hora de Colombia. `token_gestion` es un código largo y aleatorio que va en el link del cliente para cancelar o reprogramar sin iniciar sesión.

## Stack técnico y costos

La recomendación es Next.js + Supabase + Vercel: un solo proyecto, un solo lenguaje (TypeScript) y servicios administrados, para que una o dos personas lo construyan y lo operen sin servidores propios.

| Pieza | Herramienta | Por qué |
| --- | --- | --- |
| Web (las 3 aplicaciones) | Next.js + Tailwind, instalable como PWA | Un solo código para página pública, panel y admin; se "instala" en el celular sin tienda de apps |
| Base de datos y login | Supabase (PostgreSQL, Auth, Row Level Security) | Separa los datos de cada barbería desde la base de datos; login con correo y contraseña incluido |
| Hosting | Vercel | Despliegue automático desde GitHub |
| Tareas programadas | Supabase Cron + Edge Functions | Recordatorios y avisos de vencimiento |
| WhatsApp | Meta Cloud API directa | Sin intermediario que cobre por mensaje |
| Correo | Resend | Plan B de notificaciones y avisos al dueño |
| Imágenes | Supabase Storage | Logos y fotos de barberos |
| Errores | Sentry (plan gratis) | Enterarte antes que el cliente |

**Costo mensual aproximado de operación** (precios de lista a revisar al contratar):

| Concepto | Hasta \~100 barberías | \~600 barberías |
| --- | --- | --- |
| Supabase | US$0–25 | US$25–75 |
| Vercel | US$0–20 | US$20 |
| WhatsApp (≈US$0,48 por barbería) | ≈US$48 | ≈US$290 |
| Correo, dominio .co, otros | ≈US$15 | ≈US$40 |
| **Total** | **≈US$85–110** | **≈US$375–425** |

Con 600 barberías en plan Básico ($39.900) entran unos $24 millones COP al mes, y la infraestructura costaría alrededor de $1,6 millones COP (≈7%).

## Plan de construcción

Con un desarrollador dedicado de tiempo completo, el MVP queda listo en 6 semanas y la venta abierta empieza en la semana 11, después de un piloto de 4 semanas.

&#91;embedded content: plan de construcción · 6 semanas, piloto de 4, 2 compuertas\]

El piloto usa WhatsApp sin verificar el negocio (hasta 250 destinatarios al día) y la verificación se tramita antes de abrir la venta; mientras tanto, el plan B de correo y `wa.me` permite probar todo. Si las barberías piloto no lo usan a diario, se corrige antes de vender, no después.

## Fuera de alcance y fase 2

Nada de esto entra al MVP; se decide qué construir según lo que pidan las barberías piloto.

| Idea | Por qué esperar | Señal para construirla |
| --- | --- | --- |
| Cuentas por barbero con roles (administrador, recepcionista), solo plan Pro | Una semana extra de desarrollo; el link privado cubre a la mayoría | Barberías de 5 o más barberos piden que alguien más maneje la agenda |
| Pasarela de pagos y anticipos en línea | Costo, trámites y comisión | Varias barberías piden cobrar el abono automático |
| Pago de la suscripción automatizado (link de pago, conciliación) | Con menos de \~200 barberías se maneja a mano | Más de 15 pagos diarios por verificar |
| Facturación electrónica DIAN para la barbería | Complejo y no lo piden las barberías pequeñas | Barberías formales lo exigen para cambiarse |
| Inventario y venta de productos (ceras, aceites) | No es el dolor principal | Piden registrar ventas en el cierre del día |
| Fidelización (sellos, cortes gratis, cumpleaños) | Requiere uso estable primero | Barberías activas buscan traer clientes de vuelta |
| Campañas de marketing por WhatsApp | Mensajes de marketing cuestan más | Lo piden como función paga |
| Directorio o marketplace de barberías | Necesita masa crítica | Más de 300 barberías activas en una ciudad |
| Apps en Play Store y App Store | La PWA cubre el uso | Barberías lo piden para su imagen |
| Varias sedes por cuenta | Pocas cadenas al inicio | Cadenas interesadas en pagar plan superior |
| Reseñas de clientes | Moderación y reclamos | Piden mostrar reputación |

## Decisiones pendientes

- [ ] Nombre del producto y dominio (.co o .com.co).
- [ ] Quién lo desarrolla: tú, un equipo o un freelancer; esto define si el plan de 6 semanas es realista.
- [ ] Persona natural o empresa: afecta la verificación de Meta, la factura electrónica de tus ventas y las cuentas para recibir pagos (consultar con un contador). Como mínimo, sacar el RUT como persona natural antes de abrir la venta.
- [ ] Precio final de los planes, después de hablar con 10 barberías.
- [ ] Ciudad y barrios para las 10 barberías piloto.
- [ ] Número de WhatsApp dedicado a la plataforma y cuenta bancaria o Nequi para recibir pagos.
- [ ] Términos de uso y política de tratamiento de datos personales (Ley 1581 de 2012), porque se guardan nombres y celulares de los clientes.
