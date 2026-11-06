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
| Cliente final | Quien se corta el pelo | Página pública de reservas | Nombre y correo, sin contraseña ni código |

**Link privado del barbero:** el sistema lo genera al crear al barbero; el dueño lo copia para pasárselo como prefiera o, si el barbero tiene correo registrado, se lo envía por correo. Con él, el barbero ve solo su agenda del día y la semana, marca citas como atendidas o no asistió y bloquea sus horas. No ve precios totales, reportes, otros barberos ni la configuración. Si el barbero se va, el dueño desactiva el link y deja de funcionar al instante. Por seguridad el link no se guarda: cada vez que el dueño lo copia o lo envía, el sistema genera uno nuevo y el anterior deja de servir.

**Avisos al barbero (opcional):** si el dueño registra el correo del barbero y activa los avisos, este recibe por correo cada nueva reserva o cancelación, sin entrar a ninguna parte.

**Fase 2, plan Pro:** cuentas propias por barbero con roles (administrador, recepcionista), para barberías establecidas que necesitan que otra persona maneje la agenda de todos.

**Dueño que también corta:** el dueño puede crearse a sí mismo como barbero; su agenda aparece junto a las demás en el panel. En el asistente de registro hay una casilla "Yo también corto", marcada por defecto.

## Funcionalidades del MVP

Son 24 funciones: P1 es imprescindible para lanzar, P2 entra si cabe en las 6 semanas y si no pasa al primer mes después del lanzamiento.

| # | Función | Rol | Prioridad |  |
| --- | --- | --- | --- | --- |
| 1 | Página pública de la barbería con link propio (logo, dirección, mapa, horario, link a su WhatsApp) | Cliente | P1 |  |
| 2 | Reservar: servicio → barbero (o "cualquiera") → día → hora → nombre, correo y celular opcional | Cliente | P1 |  |
| 3 | Confirmación en pantalla + botón "Agregar a mi calendario" | Cliente | P1 |  |
| 4 | Link para cancelar o reprogramar la cita sin llamar | Cliente | P1 |  |
| 5 | Recordatorio de la cita (ver sección Notificaciones) | Cliente | P1 |  |
| 6 | Ver "mis citas" con un link que llega al correo, sin código | Cliente | P2 |  |
| 7 | Registro de la barbería en 3 pasos con prueba gratis de 20 días | Dueño | P1 |  |
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
| 18 | Botón para copiar y compartir el link + código QR para imprimir | Dueño | P1 |  |
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

La hora se vuelve a validar al confirmar, porque dos clientes pueden estar mirando el mismo espacio; si tiene los avisos activos, el barbero recibe por correo cada reserva y cancelación.

**2. Registro de la barbería (meta: menos de 10 minutos)**

1. El dueño entra desde un link de venta o anuncio y escribe su nombre, el nombre de la barbería, su celular (que queda como WhatsApp de contacto de la barbería), su correo y una contraseña. Confirma el correo con un link, sin código, e ingresa con su contraseña.
2. Agrega sus servicios con precio y duración. El sistema sugiere los típicos, que el dueño edita o quita: corte ($25.000, 40 min), barba ($15.000, 20 min), corte + barba ($35.000, 60 min), cejas ($8.000, 10 min) y niños ($20.000, 30 min).
3. Agrega sus barberos con nombre, foto y correo opcionales, y horario; por defecto cada barbero usa el horario de la barbería. El sistema genera el link privado de cada barbero.
4. Recibe su link y QR listos para compartir; empieza la prueba de 20 días.

**3. Cobro y activación**

1. El sistema avisa al dueño antes de vencer, con el valor y tus datos de pago.
2. El dueño transfiere y envía el comprobante a tu correo.
3. Revisas que el dinero llegó a tu cuenta.
4. En el panel de plataforma registras el pago; la barbería queda activa hasta la nueva fecha y el dueño recibe confirmación.

## Pantallas

Son 22 pantallas en tres aplicaciones; todas se diseñan primero para celular.

**Página pública de reservas** (`tuapp.co/nombre-barberia`)

1. Perfil de la barbería: logo, foto, dirección con mapa, horario, botón "Reservar" y link para escribirle por WhatsApp.
2. Elegir servicio: lista con precio y duración.
3. Elegir barbero: foto y nombre, o "El primero disponible".
4. Elegir día y hora: calendario de los próximos 30 días y horas libres.
5. Datos del cliente: nombre, correo y celular opcional; si ya reservó desde ese navegador, se autocompleta. El servidor nunca devuelve datos de un cliente a partir de lo que alguien escriba.
6. Confirmación: resumen, dirección, agregar al calendario, datos de abono si aplica.
7. Gestionar mi cita (desde el link del correo): ver, cancelar o reprogramar.

**Panel de la barbería**

1. Ingreso: correo y contraseña, con recuperación por correo.
2. Registro y asistente inicial: datos de la barbería → servicios → barberos y horarios.
3. Agenda: vista día (columnas por barbero) y semana; tocar un espacio crea cita.
4. Detalle de cita: cliente, servicio, estado y datos de contacto del cliente.
5. Nueva cita manual.
6. Bloquear horas.
7. Clientes: lista, búsqueda y ficha con historial.
8. Servicios.
9. Barberos y horarios.
10. Configuración: datos, logo, horario, festivos, política de cancelación, datos de abono.
11. Compartir: link, QR descargable y texto listo para copiar.
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

- Los espacios se ofrecen cada 15 minutos; la duración la pone el servicio (ej. corte 40 min, corte + barba 60 min). La duración va de 5 a 240 minutos, en múltiplos de 5.
- El horario de cada barbero va dentro del horario de la barbería.
- Anticipación mínima configurable (por defecto 1 hora) y máxima de 30 días.
- "El primero disponible" asigna al barbero libre con menos citas ese día.
- Al confirmar se vuelve a validar el espacio en la base de datos, para que dos clientes no tomen la misma hora.
- Festivos de Colombia precargados; la barbería decide si abre.

**Cancelación y reprogramación**

- El cliente puede cancelar o reprogramar hasta X horas antes (por defecto 2), desde el link de su correo.
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

No hay pasarela: la barbería paga por transferencia, Nequi o llave Bre-B, envía el comprobante por correo y tú registras el pago en el panel, lo que extiende su fecha de vencimiento.

**Planes propuestos (a validar con los pilotos)**

| Plan | Barberos | Precio mensual | Trimestral | Anual |
| --- | --- | --- | --- | --- |
| Básico | Hasta 3 | $39.900 COP | $107.700 COP (10% dto.) | $399.000 COP (2 meses gratis) |
| Pro | Hasta 8 | $69.900 COP | $188.700 COP (10% dto.) | $699.000 COP (2 meses gratis) |

Ambos planes incluyen todas las funciones del MVP y links privados para los barberos. Cuando lleguen las cuentas por barbero con roles (fase 2), serán exclusivas del Pro.

**Ciclo de la suscripción**

1. Registro: empieza la prueba gratis de 20 días con todo habilitado, desde que se crea la cuenta. Durante la prueba no hay límite de barberos; los límites del plan aplican al pagar. Si se registra el 4 de noviembre, funciona hasta el 24 de noviembre inclusive.
2. Avisos automáticos al dueño: 3 días antes de vencer, el día del vencimiento y 3 días después, con tus datos de pago y el valor exacto.
3. Pago: el dueño transfiere y envía el comprobante a tu correo.
4. Activación: en el panel eliges la barbería, el plan y el periodo, escribes la referencia del comprobante y guardas; el sistema calcula la nueva fecha de vencimiento.
5. Gracia: 5 días después de vencer, la barbería sigue funcionando con un aviso rojo en el panel.
6. Suspensión: pasados los 5 días, la página pública deja de recibir reservas nuevas (muestra el WhatsApp de la barbería) y el panel queda en solo lectura. Las citas ya tomadas se respetan y no se borra ningún dato.
7. Reactivación: al registrar un pago, todo vuelve a funcionar al instante.

**Regla de fechas:** si paga antes de vencer, el nuevo periodo se suma a la fecha de vencimiento; si paga ya vencido, se cuenta desde el día del pago.

## Notificaciones por correo

El correo es el único canal de mensajes automáticos, y no se usan códigos OTP. WhatsApp no envía nada: queda solo como dato de contacto de la barbería, con un link en su página pública para quien quiera escribirle. La razón es el costo y la simplicidad: sin número dedicado, sin verificación de Meta y sin aprobación de plantillas. El porqué y los riesgos aceptados están en `docs/decisiones/0006-correo-unico-canal.md`.

**Costo estimado por barbería:** 300 citas al mes × 2 correos = 600 correos. Con Amazon SES, a US$0,10 por cada 1.000 ([precios](https://aws.amazon.com/ses/pricing/)), son unos US$0,06 al mes.

**Mensajes del MVP**

| Mensaje | Para | Cuándo |
| --- | --- | --- |
| Cita confirmada + agregar al calendario + link para gestionarla | Cliente con correo | Al reservar |
| Recordatorio con links "Confirmo" / "Cancelar", que abren una pantalla y piden un toque | Cliente con correo | 24 h antes (o 3 h si la cita es para el mismo día) |
| Cita cancelada o reprogramada | Cliente con correo | Cuando la barbería cambia la cita |
| Nueva reserva o cancelación (opcional) | Barbero con correo | Al instante |
| Link privado de su agenda (opcional; el dueño también lo puede copiar) | Barbero con correo | Cuando el dueño lo envía |
| Confirmación de correo y recuperación de contraseña | Dueño | Al registrarse o al pedirla |
| Suscripción por vencer, vencida, suspendida, pago registrado | Dueño | Según el ciclo de suscripción |

**Cita manual sin correo:** el cliente no recibe confirmación ni recordatorio; la barbería lo sabe al crearla.

**Sin código, cualquiera puede escribir un correo ajeno al reservar.** Por eso: hay límites por correo e IP y verificación anti-bots invisible; cada correo lleva el link para cancelar; una reserva pública no sobrescribe la ficha de un cliente existente; y el servidor no autocompleta datos a partir de lo que alguien escriba.

**A medir en el piloto:** el correo se revisa menos que WhatsApp, y "menos clientes que no llegan" es parte de la propuesta de valor. Antes de abrir la venta hay que comparar las inasistencias de las barberías piloto con las que tenían antes. Si no bajan, se decide si vale la pena otro canal.

## Modelo de datos

Son 13 tablas: las 11 de este MVP más el horario de la barbería y los festivos en que abre. Todas las de negocio llevan `barbershop_id` para separar los datos de cada barbería (multi-tenant con seguridad a nivel de fila). En el código las tablas tienen nombre en inglés; el glosario completo y el porqué de cada decisión están en `docs/decisiones/0001-modelo-de-datos.md`.

| Tabla (en el código) | Campos principales | Relación |
| --- | --- | --- |
| barberías (`barbershops`) | nombre, slug (para el link), logo, foto, dirección, lat/lng, WhatsApp, anticipación mín., horas para cancelar, datos de abono, estado de suscripción (en prueba, activa o suspendida), plan, vence el | Raíz de todo |
| usuarios (`profiles`) | nombre, celular, rol (dueño o super admin), activo; el correo vive en la cuenta de acceso | Pertenece a una barbería (salvo super admin) |
| barberos (`barbers`) | nombre visible, foto, correo opcional, link privado (guardado solo como hash), link activo, avisos por correo, orden, activo | Pertenece a una barbería |
| horarios del barbero (`barber_schedules`) | barbero, día de la semana, hora de inicio y de fin | Varios por barbero; admiten jornada partida |
| horario de la barbería (`barbershop_hours`) | día de la semana, hora de inicio y de fin | Varios por barbería; admiten jornada partida |
| festivos que abre (`holiday_openings`) | fecha | Los festivos están cerrados por defecto; cada fila es uno en que la barbería abre |
| servicios (`services`) | nombre, precio en pesos, duración en minutos, activo | Pertenece a una barbería |
| barbero-servicio (`barber_services`) | barbero, servicio | Qué servicios hace cada barbero |
| bloqueos (`time_blocks`) | barbero (o toda la barbería), inicio, fin, motivo | Almuerzo, permisos, cierres especiales |
| clientes (`customers`) | nombre, correo (único por barbería cuando existe), celular opcional, notas; visitas e inasistencias se calculan desde las citas | Pertenece a una barbería; una reserva web exige correo y una cita manual solo el nombre |
| citas (`appointments`) | cliente, barbero, servicio, inicio, fin, precio (copiado al reservar), estado, origen (web o manual), abono recibido, link de gestión (guardado solo como hash) | El corazón del sistema |
| notificaciones (`notifications`) | cita o barbería, tipo, programada para, enviada el, estado, intentos | Cola de correos |
| pagos de suscripción (`subscription_payments`) | plan, periodo, valor en pesos, medio, referencia, fecha de pago, cubre desde y hasta, registrado por | Historial de cobros |

Los instantes (citas, bloqueos) se guardan en UTC y se muestran en hora de Colombia; las fechas de calendario (vencimientos, festivos, pagos) se guardan como fecha. Los links privados del barbero y de gestión de la cita son códigos largos y aleatorios que se guardan solo como hash, para que nadie pueda leerlos de la base de datos.

## Stack técnico y costos

La recomendación es Next.js + Supabase + Cloudflare: un solo proyecto, un solo lenguaje (TypeScript) y servicios administrados, para que una o dos personas lo construyan y lo operen sin servidores propios. El detalle, los costos y los riesgos están en `docs/decisiones/0007-infraestructura.md` (en propuesta).

| Pieza | Herramienta | Por qué |
| --- | --- | --- |
| Web (las 3 aplicaciones) | Next.js + Tailwind, instalable como PWA | Un solo código para página pública, panel y admin; se "instala" en el celular sin tienda de apps |
| Base de datos y login | Supabase Pro (PostgreSQL, Auth, Row Level Security) | Separa los datos de cada barbería desde la base de datos; login con correo y contraseña incluido |
| Hosting | Cloudflare Workers con OpenNext, si pasa la prueba de la tarea 1.10; si no, Vercel Pro | Lo estático sale gratis y la app cuesta US$5 al mes con 10 M de peticiones |
| Tareas programadas | pg_cron + Edge Functions de Supabase | Envío de la cola, recordatorios, avisos y purgas |
| Correo | Amazon SES, aislado en un solo módulo | Único canal de mensajes; el costo más bajo por correo y sin mensualidad |
| Imágenes | Cloudflare R2 | Logos y fotos de barberos, sin cobro de transferencia de salida |
| Anti-abuso | Cloudflare Turnstile y una regla de límite por IP | Gratis, y ve la IP real del cliente |
| Errores | Sentry (plan gratis) | Enterarte antes que el cliente |

**Costo mensual aproximado de operación** (precios de lista a revisar al contratar):

Con el volumen de la decisión 0006 (unas 1.200 citas al mes por sede):

| Concepto | 10 sedes | 100 sedes | 1.000 sedes |
| --- | --- | --- | --- |
| Cloudflare Workers Paid | US$5 | US$5 | ≈US$8 |
| Supabase Pro | US$25 | US$25 | US$30–80 |
| Correo (SES, ≈US$0,25 por sede) | ≈US$2,5 | ≈US$25 | ≈US$250 |
| Dominio | ≈US$3 | ≈US$3 | ≈US$3 |
| **Total** | **≈US$35** | **≈US$58** | **≈US$290–340** |

A 25.000 COP por sede (decisión 0006), el costo se cubre con unas 6 sedes pagando, y con 1.000 sedes es cerca del 5% del ingreso, a 4.000 pesos por dólar. Si la tarea 1.10 lleva a quedarse en Vercel Pro, se suman unos US$15 al mes con 10 sedes y unos US$140 con 1.000.

## Plan de construcción

Con un desarrollador dedicado de tiempo completo, el MVP queda listo en 6 semanas y la venta abierta empieza en la semana 11, después de un piloto de 4 semanas.

&#91;embedded content: plan de construcción · 6 semanas, piloto de 4, 2 compuertas\]

El piloto ya usa el correo como único canal, con dominio propio y Amazon SES, y mide si las inasistencias bajan. Si las barberías piloto no lo usan a diario, se corrige antes de vender, no después.

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
| Recordatorios por WhatsApp o SMS | Cuestan por mensaje y WhatsApp exige número dedicado, verificación y plantillas | Las inasistencias no bajan en el piloto con el correo |
| Campañas de marketing por correo | No es el dolor principal y afecta la reputación del remitente | Lo piden como función paga |
| Directorio o marketplace de barberías | Necesita masa crítica | Más de 300 barberías activas en una ciudad |
| Apps en Play Store y App Store | La PWA cubre el uso | Barberías lo piden para su imagen |
| Varias sedes por cuenta | Pocas cadenas al inicio | Cadenas interesadas en pagar plan superior |
| Reseñas de clientes | Moderación y reclamos | Piden mostrar reputación |

## Decisiones pendientes

- [ ] Nombre del producto y dominio (.co o .com.co).
- [ ] Quién lo desarrolla: tú, un equipo o un freelancer; esto define si el plan de 6 semanas es realista.
- [ ] Persona natural o empresa: afecta la factura electrónica de tus ventas y las cuentas para recibir pagos (consultar con un contador). Como mínimo, sacar el RUT como persona natural antes de abrir la venta.
- [ ] Precio final de los planes, después de hablar con 10 barberías.
- [ ] Ciudad y barrios para las 10 barberías piloto.
- [ ] Correo para recibir comprobantes y cuenta bancaria o Nequi para recibir pagos.
- [ ] Términos de uso y política de tratamiento de datos personales (Ley 1581 de 2012), porque se guardan nombres, correos y celulares de los clientes.
