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
Pendiente.

## Tarea 8.13: compartir desde el panel del profesional
Pendiente.

## Tarea 8.14: bloquear mi agenda
Pendiente.

## Tarea 8.11: invitación del profesional
Antes: la plantilla "Invite user" pegada en Supabase (`docs/tareas/8.11-invitacion.md`). Con una cuenta de dueño y un correo que puedas abrir y que nunca haya tenido cuenta en Yapoin.

- [ ] **1. El correo es el nuestro.** Invitar a un profesional desde su ficha. El correo llega en español, con el botón "Crear mi contraseña" y el encabezado de Yapoin.
- [ ] **2. No lleva a la landing.** Al tocar el botón del correo se abre "Te invitaron a ser parte de un equipo", con un solo botón: "Crear mi contraseña".
- [ ] **3. Dice quién invita.** Al tocarlo, la pantalla dice "{tu establecimiento} te ha invitado a ser parte de su equipo" y pide la contraseña y aceptar los términos.
- [ ] **4. Queda como profesional.** Al guardar entra a "Mi agenda" de ese establecimiento. En la ficha del dueño, su acceso aparece activo.
- [ ] **5. El link ya usado.** Abrir de nuevo el link del correo: dice que la invitación venció o ya se usó, y cómo entrar.
- [ ] **6. Un correo que ya tiene cuenta.** Invitar a un correo que ya es dueño en Yapoin: el dueño ve "Ese correo ya tiene una cuenta en Yapoin o una invitación pendiente", y a ese correo no le llega nada.
- [ ] **7. Solo por invitación.** Registrarse en `/registro` con un correo nuevo crea un establecimiento propio, nunca un profesional de otro.
