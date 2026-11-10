# 0006 Correo como único canal

Fecha: 2026-11-05 · Tarea: 1.8 · Estado: aceptada por el dueño del proyecto.

> **Numeración:** comparte el número 0006 con `0006-esquema-base-de-datos-final.md`. Se decidió no renombrar ninguna de las dos (tarea 1.9), porque spec, plan, tareas y la decisión 0007 las citan por nombre completo. Cuando se diga "decisión 0006" sin más, se refiere al esquema final; esta es "0006 de correo único".

## Contexto

La spec usaba WhatsApp Cloud API para confirmaciones y recordatorios. El dueño del proyecto decidió reducir costos y complejidad: el correo es el único canal de mensajes automáticos y no hay códigos OTP. WhatsApp queda solo como dato de contacto de la barbería.

Se decidió antes de la fase 2, cuando cambiar el modelo de datos aún es barato.

## Decisiones

1. **Solo correo.** Se elimina `notifications.channel` y el tipo `notification_channel`. `barbershops.whatsapp_phone` se mantiene, solo para el link de contacto en la página pública y en la pantalla de suspensión.
2. **Amazon SES como proveedor**, aislado en un solo módulo para poder cambiarlo. A US$0,10 por cada 1.000 correos y sin mensualidad, sale más barato que Resend (US$20 al mes) y no tiene el tope de unos 500 correos al día de una cuenta de Gmail, que además detendría los recordatorios si Google la pausa. **Precio actualizado por la decisión 0007:** las cuentas nuevas de SES quedan en el plan Essentials, a US$0,16 por cada 1.000; los US$0,10 son la tarifa "a la carta".
3. **El correo identifica al cliente dentro de cada barbería.**
   - `customers.email` va en minúsculas y es único por barbería cuando existe.
   - `customers.phone` es opcional y deja de ser único: sin verificación, cualquiera podría escribir uno ajeno, y la reserva fallaría o revelaría que ya existe.
4. **Datos para reservar.** La reserva web exige nombre y correo; el celular es opcional. Una cita manual solo exige el nombre, y sin correo no hay confirmación ni recordatorio. Esto último lo exige la aplicación, no la base de datos.
5. **Barberos.**
   - Se elimina `barbers.phone`, que ya no tiene uso.
   - `barbers.email` es opcional, y `email_notifications` exige que exista.
   - El dueño copia el link privado o lo envía por correo. Se quita el botón `wa.me`.
6. **Comprobantes de pago.** El dueño los envía a tu correo, porque ya no hay número de WhatsApp de la plataforma.
7. **El dueño confirma su correo con un link.**
   - Es el único canal para avisarle del vencimiento y los pagos, así que un correo mal escrito lo dejaría sin avisos.
   - El link lleva a `/auth/confirm`, que pide un toque, como el de recuperación.
   - **Confirmar no abre sesión.** Supabase registra en `amr` el mismo método (`otp`) para ambos links, tanto con el tipo `signup` como con `email`; se comprobó en local. Conservar esa sesión la dejaría crear una contraseña nueva sin pedirla (decisión 0004, punto 14). Por eso la acción cierra la sesión y el dueño ingresa con su contraseña.
   - **Link vencido.** Si el dueño intenta ingresar sin confirmar y con la contraseña correcta, se le envía un link nuevo.
8. **El registro responde igual si el correo ya tiene cuenta.** Supabase local responde `user_already_exists` aun con la confirmación activa, contra lo que preveía la decisión 0004. La acción trata ese caso como un registro normal, y el texto orienta a ingresar si el correo ya tenía cuenta. Queda una señal indirecta (ver riesgos).
9. **"Confirmo" y "Cancelar" son links**, con una pantalla que pide un toque, porque algunos filtros de correo abren los links solos. El campo para guardar la respuesta se agrega en la tarea 5.3.
10. **"Mis citas" (P2)** funciona con un link al correo, y la pantalla responde siempre lo mismo, exista o no el correo.

## Riesgos aceptados

- **Sin OTP, cualquiera puede reservar con un correo ajeno.** Se mitiga en la tarea 3.5 con límites por correo e IP y verificación anti-bots. Cada correo lleva el link para cancelar. Además, esos correos pueden perjudicar la reputación del remitente.
- **Autocompletar.** No puede salir del servidor, porque revelaría el nombre de otro cliente. Se guarda solo en el navegador de quien reservó.
- **Fichas.** Una reserva pública no sobrescribe una ficha existente, así que la agenda puede mostrar el nombre guardado y no el que se escribió.
- **Fichas repetidas.** Una cita manual sin correo puede repetir al mismo cliente, salvo que el dueño lo elija de la lista.
- **Inasistencias.** El correo se revisa menos que WhatsApp, y "menos clientes que no llegan" es parte de la propuesta de valor. El piloto debe medirlas antes de abrir la venta.
- **Links apartados.** Una cuenta sin confirmar aparta el link de su barbería sin poder entrar. La tarea 5.5 define el plazo y la limpia.
- **Un paso más.** Tras confirmar, el dueño escribe su contraseña otra vez.
- **Registrar un correo ajeno antes que su dueño.** Comprobado en local: un segundo registro sin confirmar se descarta y la cuenta conserva la contraseña y la barbería del primero. Si la víctima confirma, el otro podría entrar. Por eso el correo nombra la barbería y pide no abrir el link si no la reconoce. Quien confirme de todos modos puede recuperar la contraseña, pero hereda esa barbería.
- **Señal indirecta en el registro.** Cuando se agota el cupo de envíos, solo un correo nuevo recibe "Hiciste muchos intentos", y el tiempo de respuesta también puede diferir. Se deja así porque esconder ese error haría que un dueño real espere un correo que nunca llegará. Baja con el captcha y el límite por IP de la tarea 3.5.
- **Sin límite por cliente todavía.** Auth ve la IP del servidor, así que un abusador podría agotar el cupo de correos de todos o llenar de correos a una persona. Se resuelve en la tarea 3.5, antes del piloto.

## Ajustes de Auth por la revisión de seguridad

- **`secure_password_change` activo.** `hasRecentRecoverySession` solo protege la pantalla y la acción: con una sesión abierta, alguien podría llamar directo a la API de Auth para cambiar la contraseña. Este ajuste exige volver a autenticarse, pero según el revisor solo cuando la sesión tiene más de 24 horas; no se verificó ese plazo. Es un riesgo residual para una sesión abierta y reciente.
- **`otp_length` en 10.** Nadie escribe ese código, porque los links usan el hash del token, pero el punto de acceso de Auth podría seguir aceptándolo. Más largo, adivinarlo no es práctico.

## Costos

**Reemplazado por la decisión 0007**, que recalcula los costos con 1.200 citas al mes por sede, 2 correos por cita y el precio vigente de SES. Texto original:

Suponen 600 correos por barbería al mes, sin contar los correos a barberos y dueños.

| Barberías | Con WhatsApp | Con correo |
| --- | --- | --- |
| 10 | ≈US$53 | ≈US$49 |
| 100 | ≈US$96–116 | ≈US$54 o más |

Con 10 barberías casi no cambia. El ahorro pesa al crecer y por lo que se elimina: número dedicado, verificación de Meta y aprobación de plantillas.

## Pendiente

- Dominio y Amazon SES antes de la tarea 5.2, que incluye rebotes, quejas y los correos de Auth.
- Hasta entonces, `barberias-dev` usa el correo de prueba de Supabase, con sus límites (`docs/operacion/configurar-barberias-dev.md`).
