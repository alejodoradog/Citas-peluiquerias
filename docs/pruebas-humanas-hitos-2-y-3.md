# Pruebas humanas: hitos 2 y 3

Pruebas que hacen **el fundador y su socio, en persona y con dos celulares reales**. Las automáticas del CI ya pasan (Playwright con Android, iPhone y fidelidad al diseño, pgTAP y unitarias), pero no reemplazan esto: tiempos reales, dedos reales, red real, QR impreso.
URL: `citas-peluquerias-eta.vercel.app` (base de datos de desarrollo `barberias-dev`).

**Cómo reportar cada hallazgo:** pantalla, qué hicieron, qué esperaban, qué pasó y una captura. Al terminar, marquen las casillas y avisen para cerrar los hitos en `docs/plan.md`.

## Material
- **Celular A (dueño):** Android o iPhone, con sesión de dueño.
- **Celular B (cliente):** otro teléfono, **sin** sesión de Yapoin (en modo incógnito sirve).
- Un cronómetro.
- Una impresora o una pantalla para mostrar el QR (opcional).

## Hito 2: configuración de la barbería

**Criterio de cierre del plan:** "Creas una barbería real desde tu celular en menos de 10 minutos."

- [ ] **1. Barbería en menos de 10 minutos (celular A, cronómetro).**
  1. Crear una cuenta nueva con un correo real. Si el correo de confirmación no llega, avisar: SES sigue en modo de prueba.
  2. Completar el asistente con servicios, barberos ("Yo también corto" si aplica) y horario.
  3. Tocar "Ir a la agenda". Debe quedarse en la agenda, sin volver al asistente.
  4. Anotar el tiempo total: ______ min.
- [ ] **2. Servicios y barberos.**
  - Crear un servicio y cambiarle el precio y la duración.
  - Crear un barbero con foto y cambiarle la foto.
  - Ponerle horario propio. Salir sin guardar y volver: debe mostrar lo guardado.
- [ ] **3. Link privado del barbero.** Copiarlo, enviarlo por WhatsApp, crear uno nuevo (debe pedir confirmación) y desactivarlo. Abrir el link en el celular B debe mostrar "Muy pronto verás tus citas aquí"; la vista del barbero llega en el hito 4.
- [ ] **4. Horario, festivos y cierres.**
  - Cambiar el horario de la barbería. Intentar cerrar los 7 días: no debe dejar.
  - Activar un festivo.
  - Crear un cierre especial y borrarlo.
- [ ] **5. Reservas y cancelaciones.** Cambiar la anticipación, guardar y volver a entrar.
- [ ] **6. Datos y fotos.**
  - Subir un logo y una portada con una foto pesada de la cámara.
  - "Usar mi ubicación actual" y luego "Ver en el mapa".
  - Cambiar el WhatsApp.
- [ ] **7. Compartir.**
  - Copiar el link.
  - Descargar el QR y el **afiche** (debe llevar el logo, los colores de Yapoin y el link escrito).
  - Copiar el texto.
  - Imprimir el afiche o mostrarlo en pantalla y escanearlo con el celular B.
- [ ] **8. Cambiar el link (Más → Link de reservas).**
  - Mientras se escribe, debe decir "Disponible" o "Ya está en uso".
  - Cambiarlo. Debe aparecer el link anterior con su fecha de liberación, 3 meses después.
  - Abrir el link **viejo** en el celular B: debe llevar al nuevo.
- [ ] **9. Sedes.**
  - En Más → "+ Nueva sede", crearla y completar su asistente.
  - Cambiar entre sedes: lo de una no debe aparecer en la otra (probar con un servicio).
  - Crear hasta 4: el botón debe apagarse.
  - Eliminar una sede que no sea la única, desde Datos y fotos → "Eliminar esta sede", escribiendo su nombre. Debe volver a la otra con el aviso "Eliminamos la sede …", y el link de la eliminada debe dar "No encontramos esta página".
- [ ] **10. En general**, en todas las pantallas:
  - textos raros o con errores de ortografía;
  - botones difíciles de tocar;
  - zoom al escribir;
  - el botón "atrás" del celular;
  - red lenta (activar datos móviles, salir del wifi).

## Hito 3: reservas del cliente (requiere el PR #37 fusionado)

**Criterio de cierre del plan:** "Reservas desde otro celular en menos de un minuto, y dos reservas simultáneas a la misma hora dejan solo una."

- [ ] **11. Reservar en menos de 1 minuto (celular B, cronómetro).**
  1. Escanear el QR o abrir `…/tu-barberia`. Debe salir el perfil: portada, logo, dirección, "Abierto hoy", servicios y horario.
  2. Tocar "Reservar cita" y elegir:
     - uno o varios servicios;
     - un barbero o "El primero disponible";
     - un día y una hora; tocar **"Continuar"** (las pruebas automáticas tuvieron dificultad con ese botón: confirmar que se toca bien);
     - nombre, correo y celular opcional.
  3. Confirmar. Debe salir "¡Listo, …!" con el resumen.
  4. Anotar el tiempo: ______ s.
- [ ] **12. Dos reservas a la misma hora (celulares A y B a la vez).** Los dos eligen el mismo barbero, el mismo día y la misma hora, llenan sus datos y tocan "Confirmar reserva" al mismo tiempo, contando "3, 2, 1". Una debe confirmarse; la otra debe decir que esa hora ya la tomaron y ofrecer otras horas.
- [ ] **13. Reglas de la agenda.** La página no debe ofrecer:
  - horas fuera del horario de la barbería o del barbero;
  - festivos cerrados ni cierres especiales;
  - horas antes de la anticipación mínima (por defecto, 1 hora);
  - días más allá de 30 días.

  Un barbero que no hace un servicio no debe aparecer al elegir ese servicio.
- [ ] **14. Barbería sin horas libres.** Con un barbero que no tiene horas, debe salir "no tiene horas libres" con la próxima hora disponible.
- [ ] **15. Datos guardados.** Reservar dos veces desde el mismo celular B: la segunda vez debe proponer los datos guardados ("¿No eres …?" y "Borrar mis datos").
- [ ] **16. Revisar la reserva.** La agenda del dueño llega en el hito 4. Por ahora, que Claude confirme en la base de datos que la cita quedó con el barbero, la hora y los servicios correctos.

## Decisiones provisionales para revisar juntos
- **2.6:** ¿"Eliminar" debe aparecer también en el asistente de una sede creada por error?
- **3.1:**
  - ventana de hoy a hoy + 30, ambos incluidos;
  - "el primero disponible" elige al que menos citas tenga ese día;
  - los espacios empiezan en cuartos de hora;
  - los turnos que se tocan se unen;
  - un festivo abierto usa el horario de su día de la semana.
- **3.2-3.3 (R1-R9):**
  - todavía no hay correo de confirmación;
  - el link para gestionar la cita llega en la 3.4;
  - una tira de 31 días en vez de "Ver mes";
  - mañana, tarde y noche cortan a las 12 y a las 18;
  - los cambios de servicios tardan hasta 60 s en verse en la página pública.
- **Antes del piloto:**
  - anti-abuso con Turnstile (3.5), que necesita la llave de Cloudflare;
  - Google Maps, que necesita la llave del fundador.
