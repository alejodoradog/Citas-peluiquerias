# Especificación MVP — Yapoin, agendamiento para barberías

Nov 2, 2026 · @Alejandro · Actualizada el 2026-11-07 con las decisiones del fundador de la decisión 0006 (esquema final) y del diseño de interfaz (tarea 1.9).

**Producto:** Yapoin. **Dominio:** `yapoin.com`.

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

Cada barbería (sede) tiene un solo dueño, que entra con su cuenta; un mismo dueño puede tener varias sedes desde esa cuenta y crear otra cuando quiera. Los barberos no necesitan cuenta y ven su agenda desde un link privado. El cliente final tampoco crea cuenta.

| Rol | Quién es | Dónde entra | Cómo se identifica |
| --- | --- | --- | --- |
| Super admin | Tú y tu equipo | Panel de plataforma | Correo y contraseña |
| Dueño | Quien paga la suscripción y administra la barbería | Panel de barbería completo | Correo y contraseña; recupera acceso por correo |
| Barbero | Empleado de la barbería | Vista "Mi agenda" | Link privado y secreto, sin cuenta ni contraseña |
| Cliente final | Quien se corta el pelo | Página pública de reservas | Nombre y correo, sin contraseña ni código |

**Link privado del barbero:** el sistema lo genera al crear al barbero; el dueño lo copia para pasárselo como prefiera o, si el barbero tiene correo registrado, se lo envía por correo. Con él, el barbero ve solo su agenda del día y la semana, marca citas como atendidas o no asistió y bloquea sus horas. No ve precios totales, reportes, otros barberos ni la configuración. El dueño puede desactivar el link y deja de funcionar al instante. Si el barbero se va, el dueño **desactiva al barbero** (no se borra): no recibe citas nuevas, movidas ni bloqueos nuevos, pero con su link sigue gestionando las citas que ya tenía (marcarlas o cancelarlas), y el dueño puede reasignarlas o cancelarlas. Desactivar al barbero no desactiva su link. Por seguridad el link no se guarda: cada vez que el dueño lo copia o lo envía, el sistema genera uno nuevo y el anterior deja de servir.

**Avisos al barbero (opcional):** si el dueño registra el correo del barbero y activa los avisos, este recibe por correo cada nueva reserva o cancelación, sin entrar a ninguna parte.

**Fase 2:** cuentas propias por barbero con roles (administrador, recepcionista), para barberías establecidas que necesitan que otra persona maneje la agenda de todos. En el MVP solo existen el dueño y el super admin.

**Dueño que también corta:** el dueño puede crearse a sí mismo como barbero; su agenda aparece junto a las demás en el panel. En el asistente de registro hay una casilla "Yo también corto", marcada por defecto.

## Funcionalidades del MVP

Son 24 funciones: P1 es imprescindible para lanzar. Las P2 se construyen dentro del hito de su pantalla (decisión del fundador, 2026-11-07), sin bloquear el cierre de los flujos P1.

| # | Función | Rol | Prioridad |  |
| --- | --- | --- | --- | --- |
| 1 | Página pública de la barbería con link propio (logo, dirección, mapa, horario, link a su WhatsApp) | Cliente | P1 |  |
| 2 | Reservar: servicios (uno o varios) → barbero (o "cualquiera") → día → hora → nombre, correo y celular opcional | Cliente | P1 |  |
| 3 | Confirmación en pantalla + botón "Agregar a mi calendario" | Cliente | P1 |  |
| 4 | Link para cancelar o reprogramar la cita sin llamar | Cliente | P1 |  |
| 5 | Recordatorio de la cita (ver sección Notificaciones) | Cliente | P1 |  |
| 6 | Ver "mis citas" con un link que llega al correo, sin código | Cliente | P2 |  |
| 7 | Registro de la barbería en 3 pasos con prueba gratis de 20 días (una por cuenta: las sedes que se creen después la comparten) | Dueño | P1 |  |
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
| 19 | Aviso de pago y estado de la suscripción dentro del panel (avisos en la agenda, sin pantalla propia) | Dueño | P1 |  |
| 20 | Lista de barberías con plan, estado y fecha de vencimiento | Super admin | P1 |  |
| 21 | Botón "Registrar pago y activar hasta" | Super admin | P1 |  |
| 22 | Suspender, reactivar (solo levanta una suspensión manual si los pagos aún cubren) y extender prueba | Super admin | P1 |  |
| 23 | Historial de pagos por barbería, con anulación de un registro equivocado (deja rastro) | Super admin | P1 |  |
| 24 | Métricas básicas: barberías activas, en prueba, vencidas, ingreso mensual | Super admin | P2 |  |

## Flujos principales

Hay tres flujos que deben funcionar perfecto el día del lanzamiento: la reserva del cliente, el registro de la barbería y el cobro con activación.

**1. Reserva del cliente**

&#91;embedded content: flujo de reserva del cliente · 5 pasos, 1 validación\]

La hora se vuelve a validar al confirmar, porque dos clientes pueden estar mirando el mismo espacio; si tiene los avisos activos, el barbero recibe por correo cada reserva y cancelación.

**2. Registro de la barbería (meta: menos de 10 minutos)**

1. El dueño entra desde un link de venta o anuncio y escribe su nombre, el nombre de la barbería, su celular (que queda como WhatsApp de contacto de la barbería), su correo y una contraseña. Confirma el correo con un link, sin código, e ingresa con su contraseña.
2. Agrega sus servicios con precio y duración. Como el cliente puede reservar varios servicios en una cita, no hacen falta combos, aunque el dueño puede crearlos. El sistema sugiere los típicos, que el dueño edita o quita: corte ($25.000, 40 min), barba ($15.000, 20 min), corte + barba ($35.000, 60 min), cejas ($8.000, 10 min) y niños ($20.000, 30 min).
3. Agrega sus barberos con nombre, foto y correo opcionales, y horario; por defecto cada barbero usa el horario de la barbería. El sistema genera el link privado de cada barbero.
4. Recibe su link y QR listos para compartir; empieza la prueba de 20 días.

Después, el dueño puede crear otra sede desde su misma cuenta. La sede nueva comparte la prueba de la primera; si se crea con la prueba ya vencida, se puede configurar pero no recibe citas hasta su primer pago.

**3. Cobro y activación**

1. El sistema avisa al dueño antes de vencer, con el valor y tus datos de pago.
2. El dueño transfiere y envía el comprobante a tu correo.
3. Revisas que el dinero llegó a tu cuenta.
4. En el panel de plataforma registras el pago; la barbería queda activa hasta la nueva fecha y el dueño recibe confirmación. Cada pago cubre un mes de una sede.

## Pantallas

Son 21 pantallas principales en cuatro aplicaciones; todas se diseñan primero para celular. El diseño de cada una, con sus estados de carga, vacío y error, está en Claude Design, canvas "Prototipos Barberías" (pantallas C-xx del cliente, D-xx del dueño, B-xx del barbero, P-xx de la plataforma y E-xx de los correos). Si el diseño y esta lista difieren, manda el diseño.

**Página pública de reservas** (`yapoin.com/nombre-barberia`)

1. Perfil de la barbería: logo, foto, dirección con mapa, horario, botón "Reservar" y link para escribirle por WhatsApp.
2. Elegir servicios: lista con precio y duración; se pueden elegir varios.
3. Elegir barbero: foto y nombre, o "El primero disponible".
4. Elegir día y hora: calendario de los próximos 30 días y horas libres.
5. Datos del cliente: nombre, correo y celular opcional; si ya reservó desde ese navegador, se autocompleta. El servidor nunca devuelve datos de un cliente a partir de lo que alguien escriba.
6. Confirmación: resumen, dirección, agregar al calendario, datos de abono si aplica.
7. Gestionar mi cita (desde el link del correo): ver, cancelar o reprogramar.

**Panel de la barbería**

1. Ingreso: correo y contraseña, con recuperación por correo.
2. Registro y asistente inicial: datos de la barbería → servicios → barberos y horarios.
3. Agenda: vista día (columnas por barbero) y semana; tocar un espacio crea cita.
4. Detalle de cita: cliente, servicios, estado y datos de contacto del cliente.
5. Nueva cita manual.
6. Bloquear horas.
7. Clientes: lista, búsqueda y ficha con historial.
8. Servicios.
9. Barberos y horarios.
10. Configuración: datos, logo, horario, festivos, política de cancelación, datos de abono.
11. Compartir: link, QR descargable y texto listo para copiar.
12. Cierre del día (P2).

El estado de la suscripción no tiene pantalla propia: se muestra con avisos en la agenda (prueba por vencer, vencida en gracia, suspendida en solo lectura) y un link "Ver cómo pagar" (decisión del fundador, 2026-11-07, según el diseño). El selector de sede y "Nueva sede" se diseñan en la fase 2.

**Vista del barbero** (link privado, sin cuenta)

1. Mi agenda: citas del día y la semana, marcar atendida o no asistió, bloquear horas.

**Panel de plataforma (super admin)**

1. Lista de barberías con filtros: en prueba, activa, por vencer, vencida, suspendida.
2. Ficha de barbería: datos del dueño, uso, historial de pagos, botón "Registrar pago".

## Reglas de negocio

La regla central: una hora está libre solo si el barbero trabaja ese día, la barbería está abierta, no hay bloqueo y no choca con otra cita activa.

**Disponibilidad**

- Los espacios se ofrecen cada 15 minutos. Cada servicio dura de 5 a 240 minutos, en múltiplos de 5.
- Una cita puede llevar de 1 a 5 servicios distintos, con un solo barbero y en un solo bloque: su duración y su precio son la suma de los servicios (máximo 480 minutos), y el barbero debe ofrecerlos todos (ej. corte 40 min + barba 20 min = 60 min).
- Un barbero desactivado no aparece en la página pública ni recibe citas o bloqueos nuevos.
- El horario de cada barbero va dentro del horario de la barbería.
- Anticipación mínima configurable (por defecto 1 hora) y máxima de 30 días.
- "El primero disponible" asigna al barbero libre con menos citas ese día.
- Al confirmar se vuelve a validar el espacio en la base de datos, para que dos clientes no tomen la misma hora.
- Festivos de Colombia precargados; la barbería decide si abre.

**Cancelación y reprogramación**

- El cliente puede cancelar o reprogramar hasta X horas antes (por defecto 2), desde el link de su correo.
- La barbería puede cancelar siempre; el sistema avisa al cliente.
- Reprogramar mueve la misma cita y conserva su duración. Los servicios de una cita confirmada o atendida se pueden cambiar (por ejemplo, agregar la barba en la silla); la duración y el precio se recalculan.
- Cada cambio de estado, hora, barbero o servicios queda en el historial de la cita.

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

No hay pasarela: la barbería paga solo por transferencia (bancaria, Nequi o llave Bre-B), envía el comprobante por correo y tú registras el pago en el panel, lo que extiende su fecha de vencimiento. Los pagos registrados no se editan ni se borran: un registro equivocado se anula y queda el rastro.

**Plan único** (decisión del fundador, decisión 0006)

| Plan | Precio | Barberos |
| --- | --- | --- |
| Estándar | $25.000 COP por sede al mes | Hasta 5, de forma informativa: nunca se bloquea registrar más |

Incluye todas las funciones del MVP y los links privados de los barberos. No hay periodos trimestrales ni anuales: cada pago cubre un mes de una sede. Cada sede paga su propia suscripción (interpretación a confirmar, decisión 0006, sección 6), y el precio por encima de 5 barberos sigue abierto.

**Ciclo de la suscripción**

1. Registro: empieza la prueba gratis de 20 días con todo habilitado, desde que se crea la cuenta. Si se registra el 4 de noviembre, funciona hasta el 24 de noviembre inclusive. La prueba es por cuenta: las sedes creadas después comparten su fecha, y una sede creada con la prueba vencida espera su primer pago para recibir citas (se puede configurar mientras tanto).
2. Avisos automáticos al dueño: 3 días antes de vencer, el día del vencimiento y 3 días después, con tus datos de pago y el valor exacto.
3. Pago: el dueño transfiere y envía el comprobante a tu correo.
4. Activación: en el panel eliges la barbería, escribes la referencia del comprobante y guardas; el sistema calcula la nueva fecha de vencimiento.
5. Gracia: 5 días después de vencer, la barbería sigue funcionando con un aviso rojo en el panel.
6. Suspensión: pasados los 5 días, la página pública deja de recibir reservas nuevas (muestra el WhatsApp de la barbería) y el panel queda en solo lectura: no se crea nada ni se cambia la configuración. Solo se permite que el dueño y el barbero (por su link) marquen las citas como atendida o no asistió, y que el cliente (por su link) cancele la suya. Las citas ya tomadas se respetan y no se borra ningún dato.
7. Reactivación: al registrar un pago, todo vuelve a funcionar al instante. "Reactivar" en el panel de plataforma solo levanta una suspensión manual cuando los pagos todavía cubren la fecha; no extiende fechas.

**Regla de fechas:** la vigencia sale solo de la prueba y de los pagos no anulados. Si paga antes de vencer o el mismo día, el nuevo mes empieza al día siguiente del vencimiento; si paga ya vencido, se cuenta desde el día del pago. Un pago del 31 de enero vence el 28 de febrero. Anular un pago recalcula la vigencia.

## Notificaciones por correo

El correo es el único canal de mensajes automáticos, y no se usan códigos OTP. WhatsApp no envía nada: queda solo como dato de contacto de la barbería, con un link en su página pública para quien quiera escribirle. La razón es el costo y la simplicidad: sin número dedicado, sin verificación de Meta y sin aprobación de plantillas. El porqué y los riesgos aceptados están en `docs/decisiones/0006-correo-unico-canal.md`.

**Costo estimado por barbería:** unas 1.200 citas al mes × 2 correos (uno al cliente y uno al barbero) = 2.400 correos. Con Amazon SES Essentials, a US$0,16 por cada 1.000 ([precios](https://aws.amazon.com/ses/pricing/)), son unos US$0,38 al mes (decisión 0007, que fija ese presupuesto de 2 correos por cita).

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

**Correo del cliente:** es obligatorio en la reserva web y opcional en la cita manual. El cliente que vuelve se reconoce por su correo dentro de cada barbería. La cola de avisos se guarda 90 días.

**Cita manual sin correo:** el cliente no recibe confirmación ni recordatorio; la barbería lo sabe al crearla.

**Sin código, cualquiera puede escribir un correo ajeno al reservar.** Por eso: hay límites por correo e IP y verificación anti-bots invisible; cada correo lleva el link para cancelar; una reserva pública no sobrescribe la ficha de un cliente existente; y el servidor no autocompleta datos a partir de lo que alguien escriba.

**A medir en el piloto:** el correo se revisa menos que WhatsApp, y "menos clientes que no llegan" es parte de la propuesta de valor. Antes de abrir la venta hay que comparar las inasistencias de las barberías piloto con las que tenían antes. Si no bajan, se decide si vale la pena otro canal.

## Modelo de datos

Son 17 tablas. Todas las de negocio llevan `barbershop_id` para separar los datos de cada barbería (multi-tenant con seguridad a nivel de fila); las excepciones son `plans` (catálogo de la plataforma) y `profiles` (la persona, que se une a sus sedes por `memberships`). En el código las tablas tienen nombre en inglés. El esquema final, con su diagrama, la especificación de cada tabla y el SQL de cada migración, está en `docs/decisiones/0006-esquema-base-de-datos-final.md`, que reemplaza en parte a `docs/decisiones/0001-modelo-de-datos.md`.

| Tabla (en el código) | Campos principales | Relación |
| --- | --- | --- |
| planes (`plans`) | código, nombre, precio mensual en pesos, barberos incluidos (informativo), activo | Catálogo de la plataforma; hoy un solo plan, `standard` |
| barberías (`barbershops`) | nombre, slug (para el link), logo, foto, dirección, lat/lng, WhatsApp, anticipación mín., horas para cancelar, datos de abono, estado de suscripción (en prueba, activa o suspendida), plan, fin de la prueba, vence el | Raíz de cada sede |
| usuarios (`profiles`) | nombre, celular, super admin (sí o no), activo; el correo vive en la cuenta de acceso | Una persona; se une a sus sedes por `memberships` |
| membresías (`memberships`) | cuenta, barbería, rol (`owner` en el MVP) | Un dueño por barbería; un dueño puede tener varias sedes |
| barberos (`barbers`) | nombre visible, foto, correo opcional, link privado (guardado solo como hash), link activo, avisos por correo, orden, activo | Pertenece a una barbería |
| horarios del barbero (`barber_schedules`) | barbero, día de la semana, hora de inicio y de fin | Varios por barbero; admiten jornada partida |
| horario de la barbería (`barbershop_hours`) | día de la semana, hora de inicio y de fin | Varios por barbería; admiten jornada partida |
| festivos que abre (`holiday_openings`) | fecha | Los festivos están cerrados por defecto; cada fila es uno en que la barbería abre |
| servicios (`services`) | nombre, precio en pesos, duración en minutos, activo | Pertenece a una barbería |
| barbero-servicio (`barber_services`) | barbero, servicio | Qué servicios hace cada barbero |
| bloqueos (`time_blocks`) | barbero (o toda la barbería), inicio, fin, motivo | Almuerzo, permisos, cierres especiales |
| clientes (`customers`) | nombre, correo (único por barbería cuando existe), celular opcional, notas; visitas e inasistencias se calculan desde las citas | Pertenece a una barbería; una reserva web exige correo y una cita manual solo el nombre |
| citas (`appointments`) | cliente, barbero, inicio, fin, precio total, estado, origen (web o manual), abono recibido, link de gestión (guardado solo como hash) | El corazón del sistema; un solo bloque y un solo barbero |
| servicios de la cita (`appointment_services`) | cita, servicio, posición, precio y duración (copiados al agregarlo) | De 1 a 5 por cita; la base de datos garantiza que la cita dure y cueste la suma |
| historial de la cita (`appointment_events`) | cita, tipo de cambio, valores antes y después, quién (equipo, cliente, barbero o sistema), cuándo | Lo escriben solo los triggers |
| notificaciones (`notifications`) | cita o barbería, tipo, programada para, enviada el, estado, intentos | Cola de correos |
| pagos de suscripción (`subscription_payments`) | plan, valor en pesos, medio, referencia, fecha de pago, cubre desde y hasta (un mes), registrado por, anulación | Historial de cobros; no se edita ni se borra |

Los instantes (citas, bloqueos) se guardan en UTC y se muestran en hora de Colombia; las fechas de calendario (vencimientos, festivos, pagos) se guardan como fecha. Los links privados del barbero y de gestión de la cita son códigos largos y aleatorios que se guardan solo como hash, para que nadie pueda leerlos de la base de datos.

## Stack técnico y costos

La recomendación es Next.js + Supabase + Vercel: un solo proyecto, un solo lenguaje (TypeScript) y servicios administrados, para que una o dos personas lo construyan y lo operen sin servidores propios. El detalle, los costos, los umbrales para escalar y los riesgos están en `docs/decisiones/0007-infraestructura.md` (aceptada).

| Pieza | Herramienta | Por qué |
| --- | --- | --- |
| Web (las 3 aplicaciones) | Next.js + Tailwind, instalable como PWA | Un solo código para página pública, panel y admin; se "instala" en el celular sin tienda de apps |
| Base de datos, login e imágenes | Supabase Pro en `us-east-1` (PostgreSQL, Auth, Row Level Security, Storage) | Separa los datos de cada barbería desde la base de datos; copias de seguridad diarias y sin pausas |
| Hosting | Vercel Pro, funciones en `iad1` (Hobby solo en desarrollo) | Next.js sin adaptadores y despliegue automático desde GitHub; el plan gratis no permite uso comercial |
| Tareas programadas | pg_cron + Edge Functions de Supabase | Envío de la cola, recordatorios, avisos y purgas |
| Correo | Amazon SES en `us-east-1`, aislado en un solo módulo | Único canal de mensajes; el costo más bajo por correo y sin mensualidad |
| DNS, dominio y anti-bots | Cloudflare (solo DNS, Registrar y Turnstile) | Gratis; los registros van en "DNS only", sin proxy delante de Vercel |
| Errores | Sentry (plan gratis, a confirmar en la 6.4) | Enterarte antes que el cliente |

**Costo mensual aproximado de operación** (decisión 0007: 4 barberos por sede, 10 citas por barbero al día, 30 días y 2 correos por cita; precios de lista del 2026-11-05 a revisar al contratar):

| Concepto | 50 sedes | 600 sedes | 1.000 sedes |
| --- | --- | --- | --- |
| Supabase Pro | US$25 | ≈US$30 | ≈US$76 |
| Vercel Pro | ≈US$40 | ≈US$120 | ≈US$125 |
| Correo (SES Essentials, US$0,16 por cada 1.000) | ≈US$19 | ≈US$230 | ≈US$384 |
| Cloudflare | US$0 | US$0 | US$0 |
| **Total** | **≈US$84** | **≈US$380** | **≈US$585** |
| Sobre el ingreso, a 25.000 COP por sede | ≈21% | ≈8,1% | ≈7,4% |

A una TRM de 3.183, el costo fijo de Supabase y Vercel se cubre con unas 9 sedes pagando, y con 1.000 sedes son ≈1,86 millones de pesos al mes. El dominio se paga aparte, una vez al año.

## Plan de construcción

Con un desarrollador dedicado de tiempo completo, el MVP queda listo en 6 semanas y la venta abierta empieza en la semana 11, después de un piloto de 4 semanas.

&#91;embedded content: plan de construcción · 6 semanas, piloto de 4, 2 compuertas\]

El piloto ya usa el correo como único canal, con dominio propio y Amazon SES, y mide si las inasistencias bajan. Si las barberías piloto no lo usan a diario, se corrige antes de vender, no después.

## Fuera de alcance y fase 2

Nada de esto entra al MVP; se decide qué construir según lo que pidan las barberías piloto.

| Idea | Por qué esperar | Señal para construirla |
| --- | --- | --- |
| Cuentas por barbero con roles (administrador, recepcionista) | Una semana extra de desarrollo; el link privado cubre a la mayoría | Barberías de 5 o más barberos piden que alguien más maneje la agenda |
| Pasarela de pagos y anticipos en línea | Costo, trámites y comisión | Varias barberías piden cobrar el abono automático |
| Pago de la suscripción automatizado (link de pago, conciliación) | Con menos de \~200 barberías se maneja a mano | Más de 15 pagos diarios por verificar |
| Facturación electrónica DIAN para la barbería | Complejo y no lo piden las barberías pequeñas | Barberías formales lo exigen para cambiarse |
| Inventario y venta de productos (ceras, aceites) | No es el dolor principal | Piden registrar ventas en el cierre del día |
| Fidelización (sellos, cortes gratis, cumpleaños) | Requiere uso estable primero | Barberías activas buscan traer clientes de vuelta |
| Recordatorios por WhatsApp o SMS | Cuestan por mensaje y WhatsApp exige número dedicado, verificación y plantillas | Las inasistencias no bajan en el piloto con el correo |
| Campañas de marketing por correo | No es el dolor principal y afecta la reputación del remitente | Lo piden como función paga |
| Directorio o marketplace de barberías | Necesita masa crítica | Más de 300 barberías activas en una ciudad |
| Apps en Play Store y App Store | La PWA cubre el uso | Barberías lo piden para su imagen |
| Cobro consolidado de una cadena (`organizations`) | Cada sede paga su suscripción | Una cadena pide una sola factura |
| Reseñas de clientes | Moderación y reclamos | Piden mostrar reputación |

## Decisiones pendientes

- [x] Nombre del producto y dominio: **Yapoin**, `yapoin.com`.
- [ ] Quién lo desarrolla: tú, un equipo o un freelancer; esto define si el plan de 6 semanas es realista.
- [ ] Persona natural o empresa: afecta la factura electrónica de tus ventas y las cuentas para recibir pagos (consultar con un contador). Como mínimo, sacar el RUT como persona natural antes de abrir la venta.
- [x] Precio: plan único de $25.000 COP por sede al mes (decisión 0006). Queda abierto el precio por encima de 5 barberos.
- [ ] Ciudad y barrios para las 10 barberías piloto.
- [ ] Correo para recibir comprobantes y cuenta bancaria o Nequi para recibir pagos.
- [ ] Términos de uso y política de tratamiento de datos personales (Ley 1581 de 2012), porque se guardan nombres, correos y celulares de los clientes.
