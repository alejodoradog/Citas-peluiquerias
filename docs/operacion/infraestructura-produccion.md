# Crear la infraestructura de producción

Lo hace el fundador, en este orden. Claude Code no toca la nube: solo escribe el código y la configuración que se versiona. El porqué de cada pieza y sus costos están en `docs/decisiones/0007-infraestructura.md`.

Antes de crear cada cuenta, revisa que el precio siga igual al de la decisión 0007. Si cambió, avísalo para actualizarla.

## 1. Dominio y DNS (antes de la tarea 5.2)

- [ ] Elegir el nombre del producto y el dominio (decisión abierta 3).
- [ ] Crear la cuenta gratis de Cloudflare.
- [ ] Comprar el dominio en **Cloudflare Registrar** si el TLD aparece al buscarlo en el panel (cobra a costo). Si no aparece (por ejemplo, `.com.co`), comprarlo en otro registrador y cambiar sus nameservers a los que indique Cloudflare.
- [ ] Revisar el precio de **renovación**, no el de la promoción del primer año.

## 2. Correo con Resend (decisión 0008)

- [ ] **`barberias-dev`:** el socio lo configura con `docs/operacion/configurar-resend.md` (tarea 5.2): la cuenta, el dominio `yapoin.com` en `us-east-1`, el DNS en Cloudflare, la llave, el webhook y el SMTP de Auth.
- [ ] **Antes del piloto, pasar Resend a Pro** (US$20 al mes, 50.000 correos). El plan Free solo envía 100 al día, y 10 sedes mandan unos 800 (decisión 0008).
- [ ] **Para producción:** repetir los pasos 2 a 4 de `docs/operacion/configurar-resend.md` en `barberias-prod`. Se reutilizan la cuenta y el dominio, con una llave propia para producción.

## 3. Turnstile (tarea 3.5)

- [ ] En Cloudflare → Turnstile, crear un widget en modo **Managed** con los hostnames de la vista previa y del dominio (hasta 10 por widget).
- [ ] Guardar la llave del sitio y el secreto. La llave del sitio va en las variables de Vercel; el secreto, en **Authentication → Bot and Abuse Protection** de Supabase y en las variables sensibles de Vercel.

## 4. Supabase de producción (tarea 6.4)

- [ ] Dejar `barberias-dev` en una **organización gratis**, aparte.
- [ ] Crear una organización con plan **Pro** y, dentro, el proyecto `barberias-prod` en **`us-east-1`**, con cómputo **Micro**.
- [ ] Dejar el **Spend Cap activo**. Apagarlo antes de que el disco pase de 6,5 GB o la salida de 200 GB al mes (decisión 0007, punto 11).
- [ ] Repetir en producción los ajustes de Auth de `docs/operacion/configurar-barberias-dev.md`, con el dominio en **Site URL** y en **Redirect URLs**.
- [ ] En **Authentication → SMTP Settings**, poner el SMTP de Resend y el remitente del dominio (paso 4 de `docs/operacion/configurar-resend.md`). Subir el límite de envíos de Auth, que con SMTP propio arranca en 30 por hora.
- [ ] Activar el captcha con Turnstile.
- [ ] En **Project Settings → Data API**, dejar expuestos solo `public` y `storage`: quitar `graphql_public` si la app no usa GraphQL, para que nadie encadene varias escrituras en una sola transacción por esa vía (revisión de la tarea 1.9, decisión 0006, sección 7).
- [ ] **Las migraciones automáticas:** en GitHub → Settings → Environments, crear el ambiente `production` (si quieres, con aprobación antes de cada corrida). Dentro de él, crear el secreto `SUPABASE_PROD_DB_URL` con la cadena del **Session pooler** de `barberias-prod`.
  - Desde ahí, el workflow "Migrate barberias-prod" (`.github/workflows/migrate-prod.yml`) aplica las migraciones en cada fusión a `main`.
  - Mientras falte el secreto, solo avisa y no cambia nada.
  - La primera vez, córrelo a mano (Actions → Migrate barberias-prod → Run workflow) para crear todo el esquema.
- [ ] **Los correos de la cola en producción** (tareas 5.1 a 5.3):
  1. desplegar `send-notifications` y `resend-webhook`;
  2. poner sus secretos: `NOTIFICATIONS_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `SITE_URL` y los datos de pago `PAYMENT_BRE_B`, `PAYMENT_NEQUI` y `PAYMENT_EMAIL`;
  3. crear los dos secretos de Vault `notifications_function_url` y `notifications_secret`.

  Los pasos están en `docs/tareas/5.1-cola-de-correos.md` y en `docs/operacion/configurar-resend.md`.
- [ ] **El super admin de producción,** con `docs/operacion/crear-super-admin.md`.

## 5. Vercel Pro (tarea 6.4, antes de recibir clientes)

- [ ] Pasar el equipo a **Pro** (US$20 al mes, 1 asiento). No agregar asientos.
- [ ] Revisar en **Settings → Functions** que la región sea **`iad1`** (también la fija `vercel.json`).
- [ ] En **Settings → Domains**, agregar el dominio y copiar los registros que muestra Vercel al DNS de Cloudflare en modo **"DNS only"** (nube gris). Esperar a que Vercel muestre el certificado activo.
- [ ] Reemplazar las variables de **Production**, que hasta aquí apuntan a `barberias-dev` porque las pruebas se hacen en la URL de `main`, por las de `barberias-prod`, siguiendo la sección "Variables de producción en Vercel" de abajo. Las de Preview siguen apuntando a `barberias-dev`, y desde aquí las pruebas vuelven a las vistas previas.
- [ ] En `barberias-dev`, cambiar la **Site URL** de vuelta a una URL de vista previa, porque `citas-peluiquerias.vercel.app` pasa a ser producción.
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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Llave del sitio del widget de Turnstile. Sin ella, la app usa la del widget "Yapoin" (`src/lib/turnstile/keys.ts`) | Config | Production, y Preview con las llaves de prueba de Cloudflare |
| `TURNSTILE_SECRET_KEY` | Secreto del widget de Turnstile | **Secreta** (Sensitive) | Production, y Preview con su propio valor |
| `SUPABASE_SECRET_KEY` | Secret key de **`barberias-prod`** (`sb_secret_…`). La usan la reserva pública, "Mis citas" y el límite por IP desde el servidor (tareas 3.3, 3.5 y "Mis citas") | **Secreta** (Sensitive) | Solo Production |

Reglas de seguridad:

- **Solo lleva `NEXT_PUBLIC_` lo que puede ver cualquiera:** la URL, la llave publicable y la llave del sitio de Turnstile. Vercel exige marcarlas como **Config**.
- **Todo lo demás va como secreta y sin `NEXT_PUBLIC_`:** la llave secreta de Supabase, el secreto de Turnstile y cualquier contraseña. Si Vercel muestra el aviso "Keep This Value Private" con una de estas, se corrige el nombre; nunca se pulsa **Change to Config**.
- **Nunca en Vercel:** la contraseña de la base de datos, la llave de Resend (vive en los secretos de la Edge Function) ni la llave de AWS del respaldo (vive en GitHub) (decisión 0007, "Dónde vive cada secreto").
- **Un valor por ambiente:** Production apunta a `barberias-prod` y Preview a `barberias-dev`. Una vista previa nunca debe ver datos de producción.
- **Comprobación:**
  1. Después del **Redeploy**, abre el sitio de producción con las herramientas del navegador (pestaña **Network**) y confirma que las peticiones van a la URL de `barberias-prod`.
  2. En el código del navegador no debe aparecer ningún `sb_secret_`.
  3. Haz lo mismo en una vista previa: debe ir a `barberias-dev`.
- **Si una llave secreta llega a quedar expuesta** (en el navegador, en un chat o en el repositorio), se rota de inmediato en Supabase o en Cloudflare y se reemplaza en Vercel.

## 6. Copias y monitoreo (tarea 6.4)

- [ ] **El respaldo semanal:**
  - crear en AWS (`us-east-1`) un bucket privado de S3, con el bloqueo de acceso público activo y una regla de ciclo de vida que borre lo que tenga más de 8 semanas;
  - crear un usuario de IAM con solo `s3:PutObject` en `arn:aws:s3:::<bucket>/weekly/*`;
  - en el ambiente `production` de GitHub, crear los secretos `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY` y `BACKUP_S3_BUCKET`.

  El workflow "Back up barberias-prod" (`.github/workflows/backup-prod.yml`) corre cada domingo a las 3:00 a. m. de Bogotá: guarda los roles, el esquema y los datos en un `.tar.gz`. Córrelo a mano una vez para probarlo.
- [ ] Crear la cuenta gratis de Sentry y el monitor de disponibilidad, si siguen siendo gratis.
- [ ] Hacer el simulacro: restaurar una copia en un proyecto temporal y abrir los datos.

## Revisión mensual

- [ ] Comparar las facturas de Supabase, Vercel y AWS con la tabla de costos de la decisión 0007.
- [ ] Revisar las métricas de "Cuándo escalar o revisar" y actuar si alguna pasa su umbral.
- [ ] Revisar los rebotes y quejas en Resend (Emails → Bounced y Complained).
