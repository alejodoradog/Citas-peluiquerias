# Crear la infraestructura de producción

Lo hace el fundador, en este orden. Claude Code no toca la nube: solo escribe el código y la configuración que se versiona. El porqué de cada pieza y sus costos están en `docs/decisiones/0007-infraestructura.md`.

Antes de crear cada cuenta, revisa que el precio siga igual al de la decisión 0007. Si cambió, avísalo para actualizarla.

## 1. Dominio y DNS (antes de la tarea 5.2)

- [ ] Elegir el nombre del producto y el dominio (decisión abierta 3).
- [ ] Crear la cuenta gratis de Cloudflare.
- [ ] Comprar el dominio en **Cloudflare Registrar** si el TLD aparece al buscarlo en el panel (cobra a costo). Si no aparece (por ejemplo, `.com.co`), comprarlo en otro registrador y cambiar sus nameservers a los que indique Cloudflare.
- [ ] Revisar el precio de **renovación**, no el de la promoción del primer año.

## 2. Amazon SES (antes de la tarea 5.2, apenas exista el dominio)

- [ ] Crear la cuenta de AWS. Activar la verificación en dos pasos del usuario raíz.
- [ ] En SES, elegir la región **`us-east-1`** (N. Virginia). Todo lo de SES va en esa región.
- [ ] Revisar el plan de precios: Essentials es el que queda por defecto. Si la consola permite elegir la tarifa "a la carta", anotarlo en la decisión abierta 1 de la 0007 antes de elegir.
- [ ] Crear la identidad del **dominio** con DKIM. Copiar los registros que muestra SES al DNS de Cloudflare, en modo "DNS only".
- [ ] Agregar en Cloudflare el registro SPF y uno DMARC (`_dmarc`), empezando con `p=none` y un correo que reciba los reportes.
- [ ] Esperar a que SES muestre el dominio como verificado.
- [ ] Solicitar la salida del sandbox: tipo **Transactional**, la URL del sitio, hasta 4 correos de contacto, idioma inglés, y aceptar la política de rebotes y quejas. Amazon responde en hasta 96 horas.
- [ ] Crear el usuario de IAM para la Edge Function, con permiso solo para `ses:SendEmail` desde la identidad del dominio, y guardar su llave en un gestor de contraseñas. Se pega en los secretos de la Edge Function en la 5.2.
- [ ] Crear las credenciales SMTP de SES para Supabase Auth (las pide la 5.2).

## 3. Turnstile (tarea 3.5)

- [ ] En Cloudflare → Turnstile, crear un widget en modo **Managed** con los hostnames de la vista previa y del dominio (hasta 10 por widget).
- [ ] Guardar la llave del sitio y el secreto. La llave del sitio va en las variables de Vercel; el secreto, en **Authentication → Bot and Abuse Protection** de Supabase y en las variables sensibles de Vercel.

## 4. Supabase de producción (tarea 6.4)

- [ ] Dejar `barberias-dev` en una **organización gratis**, aparte.
- [ ] Crear una organización con plan **Pro** y, dentro, el proyecto `barberias-prod` en **`us-east-1`**, con cómputo **Micro**.
- [ ] Dejar el **Spend Cap activo**. Apagarlo antes de que el disco pase de 6,5 GB o la salida de 200 GB al mes (decisión 0007, punto 11).
- [ ] Repetir en producción los ajustes de Auth de `docs/operacion/configurar-barberias-dev.md`, con el dominio en **Site URL** y en **Redirect URLs**.
- [ ] En **Authentication → SMTP Settings**, poner el SMTP de SES y el remitente del dominio. Subir el límite de envíos de Auth, que con SMTP propio arranca en 30 por hora.
- [ ] Activar el captcha con Turnstile.
- [ ] Guardar en los secretos de GitHub `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` y el `project-ref` de producción.

## 5. Vercel Pro (tarea 6.4, antes de recibir clientes)

- [ ] Pasar el equipo a **Pro** (US$20 al mes, 1 asiento). No agregar asientos.
- [ ] Revisar en **Settings → Functions** que la región sea **`iad1`** (también la fija `vercel.json`).
- [ ] En **Settings → Domains**, agregar el dominio y copiar los registros que muestra Vercel al DNS de Cloudflare en modo **"DNS only"** (nube gris). Esperar a que Vercel muestre el certificado activo.
- [ ] Reemplazar las variables de **Production**, que hasta aquí apuntan a `barberias-dev` porque las pruebas se hacen en la URL de `main`, por las de `barberias-prod`, siguiendo la sección "Variables de producción en Vercel" de abajo. Las de Preview siguen apuntando a `barberias-dev`, y desde aquí las pruebas vuelven a las vistas previas.
- [ ] En `barberias-dev`, cambiar la **Site URL** de vuelta a una URL de vista previa, porque `citas-peluquerias-eta.vercel.app` pasa a ser producción.
- [ ] En **Settings → Billing → Spend Management**, poner un presupuesto con avisos al 50, 75 y 100%. **No activar "Pause Production Deployments"**: dejaría la app caída hasta reanudarla a mano.
- [ ] Revisar en **Billing** que Flat Rate CDN esté activo con el nivel incluido.

### Variables de producción en Vercel

En **Settings → Environment Variables**, hasta la 6.4 las dos variables de Supabase están marcadas para **Production y Preview** con los valores de `barberias-dev` (`docs/operacion/configurar-barberias-dev.md`). En la 6.4:

1. Se edita cada una y se **desmarca Production**: quedan solo en Preview, apuntando a `barberias-dev`.
2. Se crean variables nuevas, **solo para Production**, con los valores de `barberias-prod`.

Los valores de `barberias-dev` nunca se reutilizan en Production.

| Variable | Valor | Tipo | Ambiente |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL de **`barberias-prod`** | Config | Solo **Production** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de **`barberias-prod`** (`sb_publishable_…`) | Config | Solo **Production** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (tarea 3.5; el nombre exacto lo fija esa tarea) | Llave del sitio del widget de Turnstile | Config | Production, y Preview con su propio valor |
| `TURNSTILE_SECRET_KEY` (tarea 3.5; el nombre exacto lo fija esa tarea) | Secreto del widget de Turnstile | **Secreta** (Sensitive) | Production, y Preview con su propio valor |
| `SUPABASE_SECRET_KEY` | **Solo si una tarea lo pide.** La app no lo usa hoy | **Secreta** (Sensitive) | Solo Production |

Reglas de seguridad:

- **Solo lleva `NEXT_PUBLIC_` lo que puede ver cualquiera:** la URL, la llave publicable y la llave del sitio de Turnstile. Vercel exige marcarlas como **Config**.
- **Todo lo demás va como secreta y sin `NEXT_PUBLIC_`:** la llave secreta de Supabase, el secreto de Turnstile y cualquier contraseña. Si Vercel muestra el aviso "Keep This Value Private" con una de estas, se corrige el nombre; nunca se pulsa **Change to Config**.
- **Nunca en Vercel:** la contraseña de la base de datos, la llave de SES (vive en los secretos de la Edge Function) ni la llave de AWS del `pg_dump` (vive en GitHub) (decisión 0007, "Dónde vive cada secreto").
- **Un valor por ambiente:** Production apunta a `barberias-prod` y Preview a `barberias-dev`. Una vista previa nunca debe ver datos de producción.
- **Comprobación:**
  1. Después del **Redeploy**, abre el sitio de producción con las herramientas del navegador (pestaña **Network**) y confirma que las peticiones van a la URL de `barberias-prod`.
  2. En el código del navegador no debe aparecer ningún `sb_secret_`.
  3. Haz lo mismo en una vista previa: debe ir a `barberias-dev`.
- **Si una llave secreta llega a quedar expuesta** (en el navegador, en un chat o en el repositorio), se rota de inmediato en Supabase o en Cloudflare y se reemplaza en Vercel.

## 6. Copias y monitoreo (tarea 6.4)

- [ ] Crear en AWS un bucket privado de S3 para el `pg_dump` semanal, con una regla que borre lo que tenga más de 8 semanas, y un usuario de IAM con solo `s3:PutObject` en ese bucket. Su llave va en los secretos de GitHub.
- [ ] Crear la cuenta gratis de Sentry y el monitor de disponibilidad, si siguen siendo gratis.
- [ ] Hacer el simulacro: restaurar una copia en un proyecto temporal y abrir los datos.

## Revisión mensual

- [ ] Comparar las facturas de Supabase, Vercel y AWS con la tabla de costos de la decisión 0007.
- [ ] Revisar las métricas de "Cuándo escalar o revisar" y actuar si alguna pasa su umbral.
- [ ] Revisar los rebotes y quejas de SES.
