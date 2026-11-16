# Pruebas humanas: fase 7

Pruebas que hacen **el fundador y su socio, en persona, con celulares reales**, sobre `https://www.yapoin.com` (base de desarrollo `barberias-dev`). Se hacen todas juntas al final de la fase (`docs/reparto-mejoras.md`, sección 5). El formato es el de `docs/pruebas-humanas-hito-5.md`. Para cada hallazgo, anoten:
- la pantalla;
- qué hicieron;
- qué esperaban;
- qué pasó;
- una captura.

Cada tarea agrega su sección. Si dos PR crean o cambian este archivo a la vez, se dejan las secciones de los dos.

## Tarea 7.10: servicios tocables en la página pública (celular de un cliente, sin sesión)

Se usa un establecimiento de prueba con al menos dos servicios y dos profesionales.

- [ ] **1. Tocar un servicio.** Abrir `www.yapoin.com/<link>` y tocar un servicio de la lista. Debe abrir "¿Con quién?" con ese servicio ya elegido: la línea de arriba nombra ese servicio.
- [ ] **2. Sumar otro servicio.** Desde "¿Con quién?", volver a "Servicios": el servicio tocado está marcado. Marcar otro y continuar. La reserva sigue con los dos.
- [ ] **3. Terminar la reserva.** Elegir profesional, día y hora, llenar los datos y confirmar. La cita sale en la agenda del dueño con el servicio tocado.
- [ ] **4. "Reservar cita" no cambió.** En la página, tocar "Reservar cita": abre "Servicios" sin nada elegido.
- [ ] **5. Se ve que se toca.** Al tocar una fila, la fila responde enseguida. En iPhone y en Android, la flecha de la derecha se ve en cada servicio y el texto no se corta con nombres largos.
