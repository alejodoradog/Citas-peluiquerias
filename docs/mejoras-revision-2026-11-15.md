# Mejoras de la revisión del 15 de noviembre de 2026 (fase 7)
Estado: plan propuesto el 2026-11-15 por el fundador con Claude Code. Nada está construido. Varias tareas esperan una decisión del fundador (sección 3).

El fundador y el socio probaron la plataforma a mano y dejaron dos listas de apuntes: una de mejoras de interfaz y errores (más de 20 puntos y 2 preguntas) y otra de hallazgos (10 puntos). Este documento los condensa en 12 tareas, dice cómo está hoy cada cosa en el código y en qué orden se hacen.

Quién hace cada tarea y las reglas para no pisarse están en `docs/reparto-mejoras.md`.

## 1. Las 12 tareas

| Tarea | Qué resuelve | Dueño | Tamaño | Espera a |
| --- | --- | --- | --- | --- |
| 7.1 Lenguaje neutral | "Establecimiento" y "profesional" en toda la plataforma | Fundador | Mediano | D2 |
| 7.2 Registro | Tipo de establecimiento; volver de los textos legales sin perder lo escrito | Fundador | Mediano | 7.1 |
| 7.3 Asistente | Servicios genéricos, formulario de profesional vacío, ubicación obligatoria | Fundador | Mediano | 7.1, D9, D12 |
| 7.4 Bloqueos del profesional | "Todo el día"; no bloquear lo que ya está cerrado | Fundador | Mediano | — |
| 7.5 Aviso de reserva al profesional | Correo con los datos de la cita y botón de WhatsApp; WhatsApp en cada cita de la agenda | Fundador | Mediano | D6 |
| 7.6 Cuentas de profesional | Cuenta propia por invitación del dueño; reemplaza el link privado | Fundador | Grande | D4, 7.4, 7.5 |
| 7.7 Cita inmediata | El profesional atiende a quien llega sin reserva | Fundador | Mediano | 7.6, D5 |
| 7.8 Prueba de 30 días y planes | Precios con el primer mes, elegir el plan al registrarse, plan por acuerdo a WhatsApp | Socio | Grande | D3, 7.2 |
| 7.9 Afiche y logo | El afiche en la pantalla final y en Compartir; el logo oficial en todas partes | Socio | Mediano | D1, 7.1 |
| 7.10 Servicios tocables | Tocar un servicio en la página pública lleva a reservar con ese servicio | Socio | Pequeño | — |
| 7.11 Intervalo de reserva | El dueño elige cada cuánto se ofrecen las horas: 15, 30 o 60 minutos | Socio | Mediano | D8 |
| 7.12 Admin para computador | Panel de plataforma a pantalla completa, con métricas y gráficos | Socio | Grande | D10; el tipo de la 7.2 para una métrica |

Tamaños: pequeño es menos de un día de trabajo con Claude Code; mediano, de uno a dos días; grande, tres o más, con sus revisiones.

## 2. Orden

| Ola | Fundador | Socio |
| --- | --- | --- |
| 1 | 7.1, y enseguida 7.2 y 7.3 | 7.10 y 7.12 |
| 2 | 7.4 y 7.5; la decisión 0010 de las cuentas | 7.8 y 7.9 |
| 3 | 7.6 | 7.11 |
| 4 | 7.7 | Lo que quede de la 7.12 |
| Cierre | Pruebas humanas de la fase 7, los dos | |

- **La 7.1 va primero y sola.** Cambia textos de toda la aplicación en `src/ui/textos.ts`. Mientras no se fusione, nadie edita textos fuera de su bloque.
- **La 7.2 va antes de la parte de registro de la 7.8.** Las dos cambian el formulario de registro y la función que crea la cuenta.
- **La 7.4 y la 7.5 van antes de la 7.6.** Son rápidas y no dependen de las cuentas. La 7.6 las recibe ya hechas.
- **La 7.7 va después de la 7.6,** para no escribir y revisar dos veces una función que crea citas.

## 3. Decisiones que faltan
Son reglas de negocio que la spec no responde o que la cambian. Las toma el fundador, con el socio. Cada una trae lo que recomienda Claude Code.

| # | Pregunta | Recomendación | Frena |
| --- | --- | --- | --- |
| D1 | **Nombre, dominio y logo.** Los apuntes dicen "Yapoint", "Japoin" y `www.yapuin.com`. ¿Cuál es el archivo del logo oficial? | El repo y el sitio usan **Yapoin** y `www.yapoin.com`: se dejan así. El logo de hoy es un peine de barbero: confirmar si ese es el oficial ahora que la plataforma no es solo para barberías, y entregar el archivo. | 7.9 |
| D2 | **Las palabras.** ¿"Establecimiento" y "profesional" en todo? ¿Y los verbos ("cortar")? ¿Cambian las direcciones que ve el dueño (`/panel/barberos`)? | Sí a las dos palabras. "Cortar" pasa a "atender". "Cliente" se queda. Las direcciones visibles cambian a `/panel/profesionales`, con redirección desde las viejas. El código, las tablas y las rutas internas siguen en inglés como están. | 7.1 |
| D3 | **El modelo de planes.** Hoy el precio sale solo, del número de profesionales activos el día del pago. Los apuntes piden elegir el plan al registrarse. (a) Si alguien elige el plan 1 y agrega un quinto profesional, ¿qué pasa? (b) El plan 2 no tiene prueba: ¿puede recibir citas antes de pagar? (c) ¿El plan 2 paga $25.000 el primer mes y $40.000 desde el segundo? | (a) El plan elegido solo define cómo empieza la cuenta. El cobro sigue saliendo del número de profesionales, como hoy, y agregar uno nunca se bloquea. (b) No: se configura todo, pero recibe citas cuando se registra su primer pago. Ese estado ya existe para las sedes creadas con la prueba vencida. (c) Sí. | 7.8 |
| D4 | **Cuentas de profesional.** (a) Al eliminar a un profesional, ¿qué pasa con sus citas pasadas y futuras? (b) ¿Qué pasa si la misma persona trabaja en dos establecimientos? (c) ¿Entra con contraseña? (d) ¿El correo del profesional pasa a ser obligatorio? (e) ¿Su link para compartir lo trae ya elegido a él? | (a) Se borran su cuenta y sus datos personales, y sus citas pasadas quedan a nombre de "Profesional eliminado", igual que al borrar un cliente: el cierre del día y el historial de los clientes las necesitan. No se puede eliminar mientras tenga citas futuras: primero se pasan a otro profesional o se cancelan. (b) La cuenta se borra del todo solo si no tiene otro establecimiento. (c) Sí, la crea al aceptar la invitación. (d) Sí. (e) Sí: lleva al establecimiento con él ya elegido. | 7.6 |
| D5 | **Cita inmediata que choca.** Si la hora actual se cruza con una cita ya agendada, ¿avisar o bloquear? | Bloquear y decir por qué. La base de datos no permite dos citas cruzadas del mismo profesional, y esa regla no se rompe. El aviso dice con qué cita choca y cuánto tiempo libre hay. | 7.7 |
| D6 | **El correo al profesional.** (a) ¿Qué datos lleva? (b) Hoy el aviso es opcional: ¿pasa a enviarse siempre? (c) El celular del cliente es opcional al reservar: ¿pasa a ser obligatorio? | (a) Cliente, servicios, fecha y hora, duración y precio. (b) Activado por defecto cuando el profesional tiene correo; el dueño lo puede apagar. (c) Sí, si el WhatsApp es la forma de contacto. Cambia la reserva y el texto de la política de datos. Sin celular no hay botón. | 7.5 |
| D7 | **Textos según el tipo de negocio** (paciente en vez de cliente, por ejemplo). | No por ahora. Un solo lenguaje neutral para todos. El tipo se guarda para las métricas. | — |
| D8 | **El intervalo.** ¿15 minutos por defecto? ¿Las horas se cuentan desde la hora en punto o desde que abre? ¿Aplica también a las citas que crea el dueño? | 15 por defecto, para no cambiar a nadie. Desde la hora en punto, como hoy. Solo para lo que ve el cliente: el dueño y la cita inmediata siguen libres. Ojo: con 60 minutos y servicios de 40, quedan 20 minutos sin ofrecer después de cada cita. | 7.11 |
| D9 | **Ubicación obligatoria.** Hoy la ubicación solo se toma del GPS del celular. Un dueño que se registra lejos del local no la puede poner. ¿En qué paso se pide? | Un paso nuevo del asistente, con el mapa que ya existe y un punto que se puede mover con el dedo. Sin buscador de direcciones: sería un servicio nuevo (decisión 0007). | 7.3 |
| D10 | **El admin.** ¿Qué métricas van primero? No hay diseño de escritorio en `docs/diseno/`. | Establecimientos por estado y por tipo, registros por semana, citas agendadas por semana, e ingresos por mes. Que el fundador autorice a Claude Code a diseñarlo, como hizo con los correos. | 7.12 |
| D11 | **Dos apuntes se contradicen.** Uno pide un botón "Copiar" para el link privado de cada profesional; el otro pide eliminar el link privado. | No construir el botón. En la 7.6, esa lista pasa a ser "Invitar" y "Reenviar invitación". Si las cuentas se aplazan, el botón se hace en medio día. | 7.6 |
| D12 | **Servicios precargados.** "Servicio 1" y "Servicio 2": ¿con qué precio y duración? | 30 minutos y el precio vacío, que el dueño debe llenar para continuar. Otra opción: con el tipo de la 7.2, sugerir servicios propios de cada tipo y dejar los genéricos para "otro". | 7.3 |

Respuesta a la segunda pregunta de los apuntes: la fecha de fin de la prueba se muestra solo a quien eligió el plan 1. Al plan 2 se le muestra cómo hacer su primer pago (7.8).

## 4. Las tareas en detalle

### 7.1 Lenguaje neutral
- **Lo que se pidió:** la plataforma sirve a salones, consultorios, veterinarias y otros negocios. "Barbería" pasa a "establecimiento" y "barbero" a "profesional", en todo.
- **Cómo está hoy:**
  - `src/ui/textos.ts` tiene 48 líneas con "barbería" y 83 con "barbero";
  - los verbos también son de barbería: "¿Quiénes cortan en tu barbería?", "Yo también corto";
  - los correos tienen sus propios textos en `supabase/functions/send-notifications/`;
  - los términos de uso y la política de datos hablan de barberías y barberos;
  - la landing ya es neutral (#87): dice "profesionales" y rota entre barbería, spa, consultorio, veterinaria y salón.
- **Qué se hace:**
  - el barrido de todos los textos visibles: panel, asistente, página pública, links, correos, textos legales y plantillas de Auth;
  - los casos que señalaron los apuntes:

    | Hoy | Queda |
    | --- | --- |
    | "¿Quiénes cortan en tu barbería?" | "¿Quiénes atienden en tu establecimiento?" |
    | "Cada barbero recibe un link privado…" | Texto nuevo, según la 7.6 |
    | "Usa el horario de la barbería" | "Usa el horario del establecimiento" |
    | "Agregar barbero" / "Crear otro barbero" | "Añadir otro profesional" |
    | "¡Tu barbería ya recibe citas!" | "¡Tu establecimiento ya recibe citas!" |
    | "Yo también corto" | "Yo también atiendo" |
    | "Elige servicio, barbero y hora" (Compartir) | "Elige servicio, profesional y hora" |

  - `docs/spec.md` pasa a hablar de establecimientos y profesionales;
  - el código, las tablas (`barbershops`, `barbers`) y las funciones no cambian de nombre (regla de `CLAUDE.md`: código en inglés).
- **Riesgos:** es el cambio con más conflictos posibles, por eso va primero. Las pruebas que comparan textos escritos a mano hay que actualizarlas. Los textos legales cambian de fecha de actualización.

### 7.2 Registro: tipo de establecimiento y textos legales
- **Lo que se pidió:**
  - un campo para elegir el tipo: barbería, salón de belleza, veterinaria, psicología, odontología u otro, y en "otro" escribir cuál;
  - al abrir los términos o la política desde el registro, "Ir al inicio" manda a la landing y se pierde lo escrito.
- **Cómo está hoy:**
  - el registro (`src/app/(cuentas)/registro/registration-form.tsx`) pide nombre, nombre del negocio, celular, correo y contraseña;
  - la base no guarda el tipo de negocio;
  - `src/ui/legal-page.tsx` siempre enlaza a `routes.home`, que desde el #87 es la landing.
- **Qué se hace:**
  - una columna nueva en `barbershops` para el tipo, y otra para el texto de "otro", con su migración y sus pruebas;
  - el campo en el registro y en "Nueva sede";
  - el tipo llega al panel de plataforma (lo usa la 7.12);
  - el botón de los textos legales vuelve a la pantalla de donde se vino, con lo escrito intacto. Aplica también a la reserva del cliente, que enlaza los mismos textos.
- **Riesgos:** cambia la función que crea la cuenta. La 7.8 también la cambia: por eso va después.

### 7.3 Asistente de configuración
- **Lo que se pidió:**
  - dos servicios precargados con nombres genéricos, no los de barbería;
  - al añadir un segundo profesional, el formulario sale lleno con los datos del anterior;
  - la ubicación es obligatoria, para que el cliente siempre vea el mapa.
- **Cómo está hoy:**
  - los servicios sugeridos son "Corte", "Barba" y "Cejas" (`src/modulos/barberias/dominio/service.ts:26`);
  - el formulario del profesional (`src/app/(panel)/panel/configurar/equipo/barbero/barber-form.tsx`) toma sus valores iniciales una sola vez. La causa probable: Next deja montada la pantalla anterior, y al volver para añadir otro no se crea de nuevo;
  - la ubicación es opcional y está en Más › Datos (`datos/location-field.tsx`). Solo se toma del GPS del navegador.
- **Qué se hace:**
  - los servicios sugeridos según D12;
  - el formulario se crea de nuevo para cada profesional, con su prueba;
  - un paso de ubicación en el asistente (pasa de 3 a 4 pasos), con el mapa y un punto que se puede mover. Sin ubicación no se termina el asistente, y la base lo exige también;
  - "Nueva sede" pide la ubicación igual.
- **Riesgos:** un dueño que no da permiso de ubicación tiene que poder ubicar el punto a mano. Si eso falla, nadie termina el registro: se prueba en celulares reales.

### 7.4 Bloqueos del profesional
- **Lo que se pidió:**
  - una opción "Todo el día" al bloquear horas;
  - el profesional pudo bloquear horas de un lunes festivo que el establecimiento ya tenía cerrado. Lo cerrado debe salir deshabilitado.
- **Cómo está hoy:**
  - la pantalla (`src/app/b/[token]/bloquear/`) pide día, desde, hasta y motivo;
  - la función `create_time_block_by_barber` rechaza un bloqueo que choca con las citas o los bloqueos del propio profesional. No mira los cierres del establecimiento, los festivos ni los días sin horario;
  - "Todo el día" ya existe en Festivos y cierres del dueño (`horario/festivos/holidays-editor.tsx`).
- **Qué se hace:**
  - el interruptor "Todo el día", que toma la jornada completa del profesional ese día;
  - los días cerrados salen deshabilitados, y las horas ya bloqueadas no se ofrecen;
  - la base rechaza el bloqueo sobre algo ya cerrado, con un mensaje claro;
  - la misma regla en el bloqueo que hace el dueño (`/panel/bloquear`).
- **Riesgos:** toca una función a la que se llega con el link privado: pasa `revisor-seguridad`.

### 7.5 Aviso de reserva al profesional, con WhatsApp
- **Lo que se pidió:**
  - cuando un cliente reserva, al profesional le llega enseguida un correo con los datos de la cita;
  - el correo trae un botón que abre WhatsApp con el número del cliente;
  - ese mismo acceso está en cada cita de la agenda, para el profesional y para el dueño.
- **Cómo está hoy:**
  - el correo ya existe (`barber_new_booking`, tarea 5.3). Sale solo si el profesional tiene correo y el dueño activó los avisos. Dice el cliente, los servicios y la hora, sin botones;
  - sale por la cola, que corre cada minuto: "enseguida" es hasta un minuto después;
  - el celular del cliente es opcional al reservar;
  - el detalle de la cita del dueño muestra el celular como texto, sin enlace.
- **Qué se hace:**
  - el correo lleva los datos de D6 y el botón de WhatsApp cuando hay celular;
  - los avisos quedan activados por defecto;
  - un botón de WhatsApp en el detalle de la cita del dueño, en el del profesional y en la ficha del cliente;
  - si el celular pasa a ser obligatorio (D6), cambian el formulario de reserva, su ayuda y la política de datos.
- **Riesgos:** el celular es un dato personal. El profesional solo ve el de sus propias citas, y el correo lo lee al enviar, nunca lo guarda en la cola (regla Q5 de la 5.1).

### 7.6 Cuentas de profesional por invitación
- **Lo que se pidió:**
  - eliminar el link privado;
  - un rol "profesional" con cuenta propia, unido al establecimiento donde trabaja;
  - la cuenta solo se crea por invitación del dueño, que registra el correo del profesional;
  - desde su cuenta, el profesional comparte el link de reservas, que siempre lleva a su establecimiento;
  - al eliminar a un profesional, se borran su cuenta y sus datos.
- **Cómo está hoy:**
  - la spec dice lo contrario: "Los barberos no necesitan cuenta y ven su agenda desde un link privado". Las cuentas por barbero están en "Fase 2", con una semana de desarrollo estimada;
  - toda la vista del profesional (`src/app/b/[token]/`) funciona con funciones que reciben el link (`supabase/migrations/20261112400000_add_barber_agenda.sql`);
  - el único rol de `memberships` es `owner`. La tabla se diseñó para sumar roles sin reescribir los permisos;
  - el correo del profesional es opcional;
  - un profesional nunca se borra: se desactiva y su historial se queda (tarea 2.2).
- **Qué se hace:**
  1. **La decisión 0010,** antes de escribir código: reemplaza esa parte de la spec y responde D4.
  2. **El rol** `professional` en `memberships`, unido a su fila de `barbers`, y sus permisos: solo lee y cambia lo suyo.
  3. **La invitación:** el dueño escribe el correo, el sistema envía el correo de invitación, el profesional crea su contraseña y entra a su agenda. Con límite de invitaciones contra el abuso.
  4. **Las pantallas** del profesional (B-01 a B-06) pasan del link a la sesión. El ingreso lleva a cada quien a su lugar según su rol.
  5. **Compartir** desde la cuenta del profesional.
  6. **Eliminar** un profesional, según D4.
  7. **Quitar el link privado:** las rutas `/b/…`, las pantallas "Link privado" de Más y de Compartir, el correo del link y sus funciones.
- **Riesgos:**
  - es un rol nuevo que entra a la base: los permisos se revisan tabla por tabla. Lo construye `ingeniero-critico` y lo revisa `revisor-seguridad`;
  - el profesional ahora necesita correo y contraseña. Es más fricción que abrir un link;
  - la base de pruebas está vacía desde el 2026-11-15, así que no hay links en uso que migrar.

### 7.7 Cita inmediata
- **Lo que se pidió:** una opción "cita al momento" para quien llega sin reserva. La hora de inicio es la actual, el profesional elige los servicios y la duración sale de ellos.
- **Cómo está hoy:** el dueño tiene la cita manual (`/panel/citas/nueva`). El profesional no puede crear citas: solo las marca y bloquea horas.
- **Qué se hace:**
  - el botón en la agenda del profesional y en la del dueño;
  - la cita empieza ahora, con los servicios elegidos. El nombre del cliente es opcional;
  - si choca con una cita, no se crea y se explica por qué (D5);
  - cuenta en el cierre del día como cualquier cita atendida.
- **Riesgos:** es la primera vez que un profesional crea citas. La función nueva pasa `revisor-seguridad`.

### 7.8 Prueba de 30 días y planes
- **Lo que se pidió:**
  - la prueba gratis es de 30 días, no de 20, en textos y en cálculos;
  - en los precios: el plan 1 muestra $25.000 tachado y $0 el primer mes; el plan 2, $40.000 tachado y $25.000 el primer mes;
  - el mes gratis es solo del plan 1. El plan 2 no tiene prueba;
  - en los precios solo se puede elegir el primer plan. Un usuario nuevo debe poder elegir cualquiera;
  - "Crear cuenta gratis" lleva al formulario sin pasar por la elección del plan;
  - el plan por acuerdo lleva al WhatsApp 322 938 1101.
- **Cómo está hoy:**
  - la prueba es de 20 días en tres lugares que deben coincidir: `TRIAL_DAYS` (`src/modulos/suscripciones/dominio/trial.ts:6`), la función `private.new_trial_expires_on()` y la función del registro. Una prueba los compara;
  - los términos de uso dicen "20 días" escrito a mano (`src/ui/textos.ts:156`), y la spec también;
  - los precios de la landing son una lista informativa en una hoja (`src/app/_landing/landing-nav.tsx`). El primero está resaltado, pero ninguno se elige;
  - la cuenta no guarda un plan elegido: el precio sale del número de profesionales activos el día del pago (tarea 5.6);
  - el WhatsApp de Yapoin ya está en "Contáctanos".
- **Qué se hace:**
  - 30 días en la base, en el código, en los textos, en los términos y en la spec;
  - los precios con el valor tachado y el del primer mes;
  - cada plan se puede elegir y lleva al registro con ese plan. El plan por acuerdo abre WhatsApp;
  - el registro muestra el plan elegido y deja cambiarlo;
  - el plan 2 empieza sin prueba y su primer pago vale $25.000 (D3);
  - la pantalla final del asistente y Más muestran la fecha de la prueba solo al plan 1;
  - el panel de plataforma muestra el plan con que empezó cada establecimiento.
- **Riesgos:** es dinero. Pasa `revisor-seguridad`, como la 5.4 y la 5.6. Sin D3 no se puede empezar la parte del plan elegido; los 30 días y los precios tachados sí.

### 7.9 Afiche y logo
- **Lo que se pidió:**
  - en la pantalla final del asistente, una vista previa del afiche en vez del QR solo, y el botón "Descargar afiche para imprimir";
  - en Compartir también se ve el afiche;
  - el logo oficial en todos los lugares donde aparece.
- **Cómo está hoy:**
  - la pantalla final muestra el QR y "Descargar QR para imprimir" (`configurar/listo/page.tsx`);
  - Compartir muestra el QR, "Descargar QR" y un botón "Afiche" que lo descarga sin mostrarlo (`src/ui/poster-download-button.tsx`);
  - la marca aparece en `src/ui/brand.tsx` (el peine y el nombre), los íconos de `src/app/` y `public/`, la landing, el afiche y los correos.
- **Qué se hace:**
  - un componente que muestra el afiche con el mismo diseño del que se descarga;
  - la pantalla final lo muestra con su botón nuevo; Compartir lo muestra y conserva la descarga del QR solo;
  - el logo oficial (D1) en todos esos lugares.

### 7.10 Servicios tocables en la página pública
- **Lo que se pidió:** tocar un servicio lleva a reservar con ese servicio ya elegido. El botón general se queda.
- **Cómo está hoy:** la lista de servicios de `src/app/[slug]/page.tsx` es solo texto. La reserva ya acepta un servicio en la dirección (`?servicios=<id>`) y salta al paso siguiente.
- **Qué se hace:** cada fila es un enlace a la reserva con su servicio. Con área de toque de 44 px y su prueba.

### 7.11 Intervalo de reserva configurable
- **Lo que se pidió:** que el dueño elija cada cuánto se ofrecen las horas: 15 minutos, 30 minutos o 1 hora.
- **Cómo está hoy:** las horas se ofrecen cada 15 minutos, fijo (`SLOT_STEP_MINUTES` en `src/modulos/agenda/dominio/availability.ts:37`). La spec lo dice así.
- **Qué se hace:**
  - una columna en `barbershops` con el intervalo (15, 30 o 60; 15 por defecto);
  - la opción en Más › Reservas y cancelaciones (`/panel/reservas`);
  - el motor de disponibilidad usa el intervalo del establecimiento, al reservar y al cambiar una cita;
  - la base rechaza una reserva del cliente en una hora que no está en la cuadrícula;
  - la spec se actualiza.
- **Riesgos:** el motor es el corazón de la reserva. Sus pruebas se amplían antes de tocarlo.

### 7.12 Panel de plataforma para computador
- **Lo que se pidió:**
  - dejar la vista de celular y usar toda la pantalla;
  - una sección de métricas con gráficos, números y tarjetas.
- **Cómo está hoy:**
  - las tres pantallas de `/admin` miden 448 px de ancho como máximo (`max-w-md`);
  - Métricas (P-06) muestra cuántas sedes hay activas, en prueba, vencidas y suspendidas, y el ingreso del mes y del anterior.
- **Qué se hace:**
  - una distribución de escritorio: menú lateral, tabla de establecimientos con búsqueda y orden, y la ficha a lo ancho. Sigue sirviendo en celular;
  - el tablero de métricas de D10, con su evolución en el tiempo;
  - los totales se calculan en la base, con funciones que solo puede llamar el super admin.
- **Riesgos:** no hay diseño (D10). Los gráficos no deben sumar un servicio nuevo ni peso a las pantallas de los dueños.

## 5. De cada apunte a su tarea
Para comprobar que no se quedó ninguno.

**Lista de mejoras**

| Apunte | Tarea |
| --- | --- |
| Precios: plan 1 con $25.000 tachado y $0; plan 2 con $40.000 tachado y $25.000 | 7.8 |
| Logo oficial en todos los lugares | 7.9 |
| Lenguaje genérico en toda la plataforma, y sus seis casos | 7.1 |
| Pantalla final: afiche en vez del QR solo; "Descargar afiche para imprimir" | 7.9 |
| Compartir: que se vea el afiche | 7.9 |
| Solo se puede elegir el plan preseleccionado | 7.8 |
| Elegir cualquier plan al crear la cuenta | 7.8 |
| El plan por acuerdo lleva a WhatsApp | 7.8 |
| "Prueba gratis de 20 días" debe decir 30 | 7.8 |
| El mes gratis es solo del plan 1 | 7.8 |
| La fecha de fin de la prueba se calcula con 20 días | 7.8 |
| 30 días en toda la plataforma, en textos y cálculos | 7.8 |
| "Crear cuenta gratis" no pasa por la elección del plan | 7.8 |
| "Ir a inicio" desde las políticas pierde el formulario | 7.2 |
| Servicios precargados genéricos | 7.3 |
| El formulario del siguiente profesional sale lleno | 7.3 |
| Compartir: enviar a cada profesional su link, con un botón "Copiar" | 7.6 (D11) |
| Pregunta: el dominio | D1 |
| Pregunta: la fecha de la prueba solo para el plan 1 | 7.8 |

**Hallazgos**

| Hallazgo | Tarea |
| --- | --- |
| 1. Ubicación obligatoria | 7.3 |
| 2. Cuentas para profesionales | 7.6 |
| 3. "Todo el día" al bloquear | 7.4 |
| 4. Servicios interactivos para el cliente | 7.10 |
| 5. No bloquear horas ya bloqueadas | 7.4 |
| 6. Intervalo de reserva configurable | 7.11 |
| 7. Cita inmediata | 7.7 |
| 8. Correo de confirmación al profesional, con WhatsApp | 7.5 |
| 9. Tipo de establecimiento en el registro | 7.2 (y D7) |
| 10. Rediseño del admin para computador | 7.12 |

## 6. Lo que queda fuera
- **Adaptar los textos a cada tipo de negocio** (paciente, mascota): no entra, salvo que D7 diga otra cosa.
- **Lo pendiente de rendimiento** (arranque en frío, guardar sin redirigir): sigue en `docs/tareas/rendimiento-diagnostico.md`.
- **Producción (6.4) y las pruebas en celulares reales (6.2):** siguen en el plan. Las pruebas humanas de la fase 7 se suman a las de los hitos anteriores.
