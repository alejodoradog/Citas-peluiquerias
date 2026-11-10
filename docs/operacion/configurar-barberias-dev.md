# Conectar `barberias-dev` a Vercel

Hasta la tarea 6.4, la app desplegada en Vercel usa el proyecto `barberias-dev` de Supabase, tanto en **Production** como en las vistas previas. Esto lo hace el dueño del proyecto: Claude Code no toca la nube.

**Dónde se prueba:** en la URL fija de `main`, `https://citas-peluquerias-eta.vercel.app`, después de fusionar cada PR (decisión del fundador, 2026-11-06). Así la Site URL de Supabase no cambia con cada rama. El código sigue llegando a `main` solo por PR con los chequeos en verde, y los merges los hace la cuenta `alejodoradog`, porque en Hobby Vercel bloquea los despliegues cuyo autor no es el dueño del equipo.

**Estado actual (2026-11-07):** `barberias-dev` ya existe, en **East US (North Virginia), `us-east-1`**, con cómputo Nano, dentro de una **organización gratis aparte de la de producción** (decisión 0007, puntos 2 y 4). Vercel sigue en el plan **Hobby** hasta la 6.4, y sus funciones corren en `iad1` (fijado en `vercel.json`).

**En la 6.4, antes de recibir clientes,** las variables de Production se reemplazan por las de `barberias-prod` (`docs/operacion/infraestructura-produccion.md`, "Variables de producción en Vercel"). Desde ese momento, las pruebas vuelven a las vistas previas.

## 0. Crear el proyecto (si aún no existe)

1. En [supabase.com](https://supabase.com), crea una organización nueva con plan **Free**. Debe ir aparte de la de producción, porque en una organización Pro cada proyecto suma US$10 al mes (decisión 0007, punto 4).
2. Dentro de ella, crea el proyecto:
   - **Name:** `barberias-dev`.
   - **Database password:** genérala y guárdala en un gestor de contraseñas. Nunca la pegues en un chat ni en el repositorio.
   - **Region:** East US (North Virginia), `us-east-1`, la misma de producción.
3. Anota el identificador que aparece en la URL: `supabase.com/dashboard/project/TU_REF`.

## 1. Variables en Vercel

En vercel.com, entra al proyecto **citas-peluquerias** → **Settings** → **Environment Variables** → **Add Environment Variable**. Crea estas dos:

| Variable | Valor (Supabase → proyecto `barberias-dev`) |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API**: "Project URL" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys**: "Publishable key" (`sb_publishable_…`) |

- **Tipo Config.** Vercel crea las variables como secretas y rechaza un nombre con `NEXT_PUBLIC_`, porque ese prefijo las expone al navegador. Estas dos son públicas a propósito, así que se pulsa **Change to Config**. No se quita el prefijo: el código lee esos nombres.
- **Production y Preview.** En **Environments**, marca **Production** y **Preview**, sin elegir ramas. No marques **Development**, porque en el computador se usa el Supabase local. Production apunta a `barberias-dev` solo hasta la 6.4.
- **Revisa que no queden intercambiadas.** Si la URL y la llave van al revés, el registro falla sin llegar a Supabase, y las páginas con sesión responden "Internal Server Error". Los valores se fijan al construir: un despliegue hecho con valores malos sigue roto aunque se corrijan las variables, así que hay que volver a desplegar.
- **No agregues la clave secreta (`SUPABASE_SECRET_KEY`).** La app todavía no la usa, y es mejor no tenerla expuesta hasta que haga falta. Si algún día hace falta, va como **secreta** y sin `NEXT_PUBLIC_` (`docs/operacion/infraestructura-produccion.md`, sección 5).

## 2. Tablas en `barberias-dev`

Un proyecto nuevo está vacío. En tu computador, desde la carpeta del proyecto y en `main` actualizado:

```bash
pnpm supabase login
pnpm supabase link --project-ref TU_REF
```

`login` abre el navegador para autorizar la CLI, y se hace una sola vez. `link` pide la contraseña de la base de datos.

`TU_REF` es el identificador que aparece en la URL del proyecto: `supabase.com/dashboard/project/TU_REF`.

```bash
pnpm supabase db push --remote
```

Con la CLI 3, `db push` sin `--remote` apunta a la base local y responde "Local database is up to date" sin subir nada. Con `--remote`, la CLI lista las migraciones que va a aplicar y pide confirmación. Al terminar, el Table Editor de `barberias-dev` debe mostrar las tablas.

**Nunca agregues `--include-seed`.** El seed crea un super admin con contraseña pública (`docs/operacion/datos-de-prueba.md`).

Repite el `db push --remote` cada vez que se fusione un PR con migraciones nuevas, hasta que GitHub Actions lo haga solo.

**Migraciones automáticas desde el CI (2026-11-07):** el workflow `.github/workflows/migrate-dev.yml` aplica las migraciones a `barberias-dev` en cada push a `main` que traiga cambios en `supabase/migrations`, y también se puede correr a mano desde **Actions → Migrate barberias-dev → Run workflow**. Necesita un secreto del repositorio que crea un administrador en GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

- **Nombre:** `SUPABASE_DEV_DB_URL`.
- **Valor:** en Supabase → proyecto `barberias-dev` → **Connect** → **Session pooler**, la cadena `postgresql://postgres.TU_REF:[YOUR-PASSWORD]@…pooler.supabase.com:5432/postgres`, con la contraseña de la base de datos en lugar de `[YOUR-PASSWORD]`.

Esa cadena solo abre `barberias-dev`: nunca sirve para producción. Mientras el secreto no exista, el workflow se salta con un aviso y el `db push --remote` sigue siendo a mano.

**Estado (2026-11-09):** el secreto existe y el workflow aplicó las migraciones del Hito 1. Si la contraseña de la cadena está mal, el paso falla con `password authentication failed (SQLSTATE 28P01)`. Para arreglarlo, se crea una contraseña nueva de la base de datos, solo con letras y números, se actualiza el secreto y se usa **Re-run failed jobs**. Si la contraseña tiene símbolos, la cadena se rompe: hay que cambiar cada símbolo por su código (por ejemplo `@` por `%40`) o no usarlos.

## 3. Auth en `barberias-dev`

En Supabase → **Authentication**:

- **Sign In / Providers → Email:** deja activado **Confirm email** (decisión 0006), activa **Secure password change** y pon la longitud del código (**Email OTP length**) en 10, como en `supabase/config.toml`.
- **Password:** contraseña mínima de 8 caracteres.
- **URL Configuration:**
  - **Site URL:** `https://citas-peluquerias-eta.vercel.app`. Es la dirección a la que apuntan los links de los correos; no limita desde dónde se usa la app.
  - **Redirect URLs:** `https://citas-peluquerias-eta.vercel.app/**` y `https://citas-peluquerias-*-alejodoradogs-projects.vercel.app/**`.
- **Plantillas de correo: esperan a la tarea 5.2.** Supabase solo permite editarlas con un SMTP propio ("Set up custom SMTP to edit templates"), y el nuestro será Amazon SES (decisión 0007). Cuando esté:
  - **Emails → Reset password:** pega la plantilla de `supabase/templates/recovery.html` y pon de asunto "Recupera tu acceso".
  - **Emails → Confirm signup:** pega la plantilla de `supabase/templates/confirmation.html` y pon de asunto "Confirma tu correo".
  - Se copia el archivo completo, en la pestaña **Source**, sin cambiar lo que va entre llaves dobles.

**Mientras tanto, en las vistas previas** Supabase usa sus plantillas por defecto, en inglés, con un link (`{{ .ConfirmationURL }}`) que no pasa por `/auth/confirm`:

- **Confirmar correo funciona:** el link confirma el correo y lleva a la Site URL. Luego se entra por `/ingresar` con el correo y la contraseña.
- **Recuperar la contraseña no funciona en las vistas previas:** el link no crea la sesión que necesita `/nueva-clave`. Se prueba en local (Mailpit) hasta la 5.2.
- En local y en CI no cambia nada: Supabase local usa las plantillas del repositorio (`supabase/config.toml`).

**Estado observado (2026-11-09):** Auth de `barberias-dev` ya envía por un SMTP propio con Amazon SES, que sigue en modo de prueba en la región `us-east-2`. En ese modo, SES solo entrega a correos verificados uno por uno: con cualquier otro correo, el registro falla con `554 Email address is not verified` y la pantalla muestra "No pudimos completar la acción". Mientras tanto, para probar el registro hay que verificar el correo de prueba en **SES → Identities**. Los links de los correos apuntan a `https://yapoin.com`, que ya sirve esta misma app en Vercel. La decisión 0007 pide SES en `us-east-1`, así que está pendiente confirmar la región con el fundador.

**Límite mientras no haya remitente propio:** el correo de prueba de Supabase solo envía a direcciones del equipo del proyecto, y unos 2 correos por hora ([documentación](https://supabase.com/docs/guides/auth/auth-smtp)). Para probar el registro en una vista previa, usa un correo de ese equipo. Con otro correo, Supabase rechaza el envío ("Email address not authorized") y la pantalla muestra "No pudimos completar la acción". Esto se resuelve al configurar Amazon SES (tarea 5.2), y entonces hay que subir también el límite de envíos de Auth, que por defecto es de 30 correos por hora.

## 4. Volver a desplegar

En Vercel → **Deployments** → el último despliegue de `main` → **Redeploy**, eligiendo **Production**. Las variables nuevas solo aplican a despliegues nuevos.

## Cómo verificar

1. Abre `https://citas-peluquerias-eta.vercel.app/registro` y crea una barbería de prueba con un correo del equipo.
2. Abre el link que te llega. Hasta la 5.2 es el correo en inglés de Supabase, que confirma y te lleva a la Site URL; desde la 5.2 será nuestra pantalla con "Continuar".
3. Entra por `/ingresar` con tu contraseña. Debes llegar a `/panel`.

**Si algo falla:**

- **"Algo salió mal":** el despliegue no tiene las variables. Revisa que estén marcadas para Production y que el despliegue sea posterior a cuando las agregaste.
- **"Internal Server Error":** la URL y la llave están intercambiadas o mal escritas. Corrígelas y vuelve a desplegar.

También revisa en **Emails** que el link dure una hora, como dice la plantilla.
