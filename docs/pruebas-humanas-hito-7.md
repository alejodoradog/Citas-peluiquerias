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

## Tarea 7.10: servicios tocables en la página pública
Desde el celular de un cliente, sin sesión, con un establecimiento de prueba que tenga al menos dos servicios y dos profesionales.

- [ ] **1. Tocar un servicio.** Abrir `www.yapoin.com/<link>` y tocar un servicio de la lista. Debe abrir el paso del profesional con ese servicio ya elegido: la línea de arriba nombra ese servicio.
- [ ] **2. Sumar otro servicio.** Desde el paso del profesional, volver a "Servicios": el servicio tocado está marcado. Marcar otro y continuar. La reserva sigue con los dos.
- [ ] **3. Terminar la reserva.** Elegir profesional, día y hora, llenar los datos y confirmar. La cita sale en la agenda del dueño con el servicio tocado.
- [ ] **4. "Reservar cita" no cambió.** En la página, tocar "Reservar cita": abre "Servicios" sin nada elegido.
- [ ] **5. Se ve que se toca.** Al tocar una fila, la fila responde enseguida. En iPhone y en Android, la flecha de la derecha se ve en cada servicio y el texto no se corta con nombres largos.
