# 0004 Registro e ingreso

Fecha: 2026-11-04 · Tarea: 1.4 · Estado: aceptada por el dueño del proyecto.

## Contexto

El dueño y el super admin entran con correo y contraseña (Supabase Auth). El registro es el paso 1 del flujo de la spec. El dueño no puede quedar con una cuenta sin barbería, y nadie debe poder darse un rol o una fecha de vencimiento desde el navegador.

## Decisiones

1. **Registro atómico con un trigger.**
   - La app llama a `supabase.auth.signUp` con los datos del registro como metadatos: `owner_name`, `barbershop_name`, `barbershop_slug` y `phone`.
   - El trigger `on_auth_user_created` crea la barbería y el perfil del dueño en la misma transacción que la cuenta.
   - Si algo es inválido, falla todo el registro y no queda una cuenta a medias.
2. **Los metadatos vienen del navegador, así que no se confía en ellos.**
   - El rol siempre es `owner`.
   - La fecha de vencimiento la calcula la base de datos.
   - Formato, unicidad y longitudes los vuelven a validar los checks de las tablas.
   - El celular debe ser un móvil colombiano en E.164 (`+573…`), y el trigger lo exige aunque alguien llame a la API sin pasar por la app.
   - Cambiar los metadatos después del registro no crea ni cambia nada: el trigger solo corre al crear la cuenta.
3. **Prueba gratis de 20 días** (decisión del dueño del proyecto; la spec decía 14). La barbería funciona el día del registro, en hora de Colombia, y 20 días más. Si se registra el 4 de noviembre, funciona hasta el 24 de noviembre inclusive. La regla vive en `trialEndsOn` (`src/modulos/suscripciones/dominio`, con pruebas) y la base de datos aplica la misma fórmula al registrar, porque no puede confiar en una fecha que llegue del navegador.
4. **El registro pide también el nombre del dueño**, para saludarlo en el panel y en los avisos.
5. **Sin confirmación de correo en el MVP.** El dueño entra de inmediato. Se puede activar después en la configuración de Supabase sin afectar las cuentas existentes.
   - Riesgo aceptado: sin confirmación, alguien puede registrarse con el correo de otra persona y ocuparlo, o crear muchas barberías de prueba para apartar links. Supabase limita los registros por IP, pero como el registro pasa por el servidor, ve la IP de Vercel y no la de cada persona: ese límite es compartido por todos y no frena a un abusador.
   - Recomendación: activar la confirmación de correo o un captcha antes de abrir la venta (semana 11).
   - Una cuenta creada sin datos de barbería (por la API, o un super admin creado a mano) no recibe perfil, y por eso no entra a nada. La 1.4b debe tratarla como "sin acceso".
6. **Reglas puras en `src/modulos/barberias/dominio`, con pruebas:**
   - `normalizeColombianMobile`: celular colombiano a E.164.
   - `slugFromName` y `slugCandidate`: el link público de la barbería.
   - `parseRegistration`: validación con Zod, que devuelve códigos de error. Los textos van en `src/ui/textos.ts`.
7. **Links reservados.** Una barbería no puede usar como link una ruta de la app (`panel`, `admin`, `registro`…) ni uno que parezca de la plataforma (`ayuda`, `soporte`, `terminos`, `privacidad`, `www`, `login`). La lista vive en `slug.ts` y en un check de la base de datos, y una prueba de Vitest falla si dejan de ser iguales.
8. **Super admin a mano.** Nunca se crea por el registro. El procedimiento está en `docs/operacion/crear-super-admin.md`.
9. **Contraseña mínima de 8 caracteres** y máxima de 72 bytes, porque bcrypt solo lee 72 bytes; una letra con tilde ocupa 2.
10. **Correo de recuperación en español** (`supabase/templates/recovery.html`). El link lleva a `/auth/confirm`, que se construye en la 1.4b. En local los correos se ven en Mailpit (`http://127.0.0.1:44324`). En producción saldrán por Resend, configurado en la 6.4, que además debe repetir en el panel de Supabase la contraseña mínima y la plantilla.

11. **Quién entra a dónde lo decide solo `profiles`.** `getCurrentAccess` (`src/lib/auth/access.ts`) lee la cuenta con `getUser`, que valida con Supabase, y después el perfil por RLS. Nunca usa `user_metadata`, que el usuario puede cambiar. Hay cuatro casos:
    - Dueño activo: entra a `/panel`.
    - Super admin activo: entra a `/admin`.
    - Cuenta sin perfil, desactivada o con un rol desconocido: va a `/ingresar`, que consulta la base de datos, explica que no tiene acceso y ofrece cerrar la sesión. Esa sesión no ve ningún dato. El aviso no viaja en la URL, así que no se pierde entre redireccionamientos ni se puede falsificar con un link.
    - Sin sesión: va a `/ingresar`.
    - Si falla la consulta (red, tiempo de espera), se lanza el error en lugar de tratarlo como "sin acceso", para no sacar a un dueño válido.
12. **`proxy.ts` solo en las rutas de cuentas, panel y admin.** Refresca la sesión antes de que la página se dibuje. Las páginas públicas no lo usan y siguen funcionando aunque Supabase no esté configurado, como en una vista previa sin base de datos.
13. **Con `cacheComponents`, la sesión se lee dentro de `<Suspense>`.** El marco de cada pantalla se prerenderiza y carga al instante, y la parte que depende de la cuenta llega después. El cliente de Supabase del servidor lee las cookies antes que las variables de entorno, para que el build no exija Supabase.
14. **El link de recuperación pide un toque.** `/auth/confirm` muestra un botón "Continuar" y solo entonces gasta el token, porque algunos filtros de correo abren los links solos. El token se valida con Zod. `next` solo acepta rutas de una lista (`safeNextPath`), así que un link armado a mano no puede mandar a otro sitio.
    - **La contraseña nueva solo se puede crear desde la sesión que abrió el link,** y dentro de la hora siguiente (`cameFromRecentRecovery`, que lee el método de ingreso `amr` del token). Una sesión que alguien dejó abierta en el celular de la barbería no basta para quedarse con la cuenta.
    - **Cerrar sesión cierra solo este aparato.**
15. **Mensajes.**
    - La recuperación responde siempre lo mismo, exista o no la cuenta, incluso si Supabase limita los envíos.
    - El ingreso dice "el correo o la contraseña no coinciden", sin decir cuál de los dos falla.
    - El registro sí dice "ya existe una cuenta con ese correo", porque sin confirmación de correo no hay otra forma útil de orientar al dueño. Es un riesgo aceptado: permite saber qué correos tienen cuenta. Desaparece al activar la confirmación, que Supabase responde igual en ambos casos.
16. **Las pruebas de punta a punta solo corren contra Supabase local.** Crean cuentas con contraseñas conocidas, incluidos super admins, así que `playwright.config.ts` y el helper se niegan a correr si la URL no es `127.0.0.1` o `localhost`.
17. **Módulo `cuentas`** (`src/modulos/cuentas`) para ingreso, salida y recuperación, que sirven a dueños y super admins. El registro vive en `barberias` porque crea una barbería.

## División de la tarea

- **1.4a, base de cuentas:** esta decisión, con pruebas pgTAP y Vitest.
- **1.4b, pantallas:** registro, ingreso, recuperación, nueva contraseña y cierre de sesión; `proxy.ts` y la protección de `/panel` y `/admin`; pruebas de Playwright con Supabase en CI.
