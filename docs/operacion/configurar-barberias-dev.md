# Conectar `barberias-dev` a las vistas previas de Vercel

Las vistas previas de Vercel (una por cada PR) usan el proyecto `barberias-dev` de Supabase. Esto lo hace el dueño del proyecto: Claude Code no toca la nube.

## 1. Variables en Vercel

En vercel.com, entra al proyecto **citas-peluquerias** → **Settings** → **Environment Variables**. Deben existir estas dos, marcadas para **Preview** (y, si quieres, para **Development**):

| Variable | Valor (Supabase → proyecto `barberias-dev`) |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API**: "Project URL" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys**: "Publishable key" (`sb_publishable_…`) |

- **No agregues la clave secreta (`SUPABASE_SECRET_KEY`).** La app todavía no la usa, y es mejor no tenerla expuesta hasta que haga falta.
- **No las marques para Production.** Producción tendrá su propio proyecto (`barberias-prod`) en la fase 6.

## 2. Tablas en `barberias-dev`

Un proyecto nuevo está vacío. En tu computador, desde la carpeta del proyecto y en `main` actualizado:

```bash
pnpm supabase link --project-ref TU_REF
```

`TU_REF` es el identificador que aparece en la URL del proyecto: `supabase.com/dashboard/project/TU_REF`.

```bash
pnpm supabase db push
```

**Nunca agregues `--include-seed`.** El seed crea un super admin con contraseña pública (`docs/operacion/datos-de-prueba.md`).

Repite el `db push` cada vez que se fusione un PR con migraciones nuevas, hasta que GitHub Actions lo haga solo (fase 6).

## 3. Auth en `barberias-dev`

En Supabase → **Authentication**:

- **Sign In / Providers → Email:** deja activado **Confirm email** (decisión 0006), activa **Secure password change** y pon la longitud del código (**Email OTP length**) en 10, como en `supabase/config.toml`.
- **Password:** contraseña mínima de 8 caracteres.
- **URL Configuration:**
  - **Site URL:** la URL de vista previa de Vercel.
  - **Redirect URLs:** `https://citas-peluquerias-*-alejodoradogs-projects.vercel.app/**`.
- **Emails → Reset password:** pega la plantilla de `supabase/templates/recovery.html` y pon de asunto "Recupera tu acceso".
- **Emails → Confirm signup:** pega la plantilla de `supabase/templates/confirmation.html` y pon de asunto "Confirma tu correo".

**Límite mientras no haya remitente propio:** el correo de prueba de Supabase solo envía a direcciones del equipo del proyecto, y unos 2 correos por hora ([documentación](https://supabase.com/docs/guides/auth/auth-smtp)). Para probar el registro en una vista previa, usa un correo de ese equipo. Con otro correo, Supabase rechaza el envío ("Email address not authorized") y la pantalla muestra "No pudimos completar la acción". Esto se resuelve al configurar Amazon SES (tarea 5.2), y entonces hay que subir también el límite de envíos de Auth, que por defecto es de 30 correos por hora.

## 4. Volver a desplegar

En Vercel → **Deployments** → el último despliegue → **Redeploy**. Las variables nuevas solo aplican a despliegues nuevos.

## Cómo verificar

Abre `/registro` en la URL de vista previa y crea una barbería de prueba con un correo del equipo. Abre el link que te llega, toca "Continuar" e ingresa con tu contraseña. El link siempre abre la **Site URL**, así que debe ser la URL de la vista previa que estás probando. También revisa en **Emails** que el link dure una hora, como dice la plantilla. Debes llegar a `/panel`. Si sale "Algo salió mal", revisa que las dos variables estén marcadas para Preview y que el despliegue sea posterior a cuando las agregaste.
