# Configurar Resend (tarea 5.2, decisión 0008)

Esto lo hace el fundador, o el socio con su acceso, **una vez por proyecto de Supabase**: primero `barberias-dev` y, en la 6.4, producción.

- **Ninguna llave entra al repositorio ni al chat:** el repo es público (`docs/operacion/repo-publico.md`).
- **Claude Code no puede hacerlo:** los comandos remotos de Supabase están bloqueados por diseño. Guía cada paso.

## 1. La cuenta y el dominio
1. Crea la cuenta en [resend.com](https://resend.com). El plan Free alcanza para `barberias-dev`; el piloto necesita Pro (decisión 0008).
2. **Domains → Add domain:** `yapoin.com`, en la región **North Virginia (`us-east-1`)**.
3. Resend muestra los registros **SPF** (TXT y MX en un subdominio de envío) y **DKIM** (TXT).
   - Agrégalos en **Cloudflare → DNS**, en modo **DNS only** (nube gris), igual que el resto (decisión 0007, punto 2).
   - Agrega también **DMARC**: un TXT en `_dmarc.yapoin.com` con `v=DMARC1; p=none; rua=mailto:<tu correo>`. Se endurece a `quarantine` cuando los envíos estén estables.
4. Espera a que Resend marque el dominio como **Verified**. Sin eso, los correos se quedan en la cola y se reintentan (código `http_403`).

## 2. La llave y los secretos de las funciones
1. **API Keys → Create:** permiso **Sending access**, solo para `yapoin.com`. Cópiala una sola vez.
2. En Supabase (`barberias-dev`) → **Edge Functions → Secrets**, agrega:

| Nombre | Valor |
| --- | --- |
| `RESEND_API_KEY` | La llave del paso anterior. |
| `EMAIL_FROM` | `Yapoin <citas@yapoin.com>` |
| `SITE_URL` | `https://www.yapoin.com` |
| `PAYMENT_BRE_B`, `PAYMENT_NEQUI`, `PAYMENT_EMAIL` | Los datos de pago, cuando existan (decisión E5). Mientras falten, los correos dicen "Te enviaremos los datos de pago por correo". |

3. **Despliega las dos funciones** desde tu terminal:
   ```
   pnpm supabase functions deploy send-notifications --project-ref <ref>
   pnpm supabase functions deploy resend-webhook --project-ref <ref>
   ```
   `send-notifications` ya necesita sus secretos de la 5.1 (`NOTIFICATIONS_SECRET` y los dos de Vault, `docs/tareas/5.1-cola-de-correos.md`).

## 3. El webhook de rebotes y quejas
1. En Resend → **Webhooks → Add endpoint:** `https://<ref>.supabase.co/functions/v1/resend-webhook`, con los eventos `email.bounced` y `email.complained`.
2. Copia el **Signing secret** (empieza por `whsec_`) y guárdalo en Supabase → Edge Functions → Secrets como `RESEND_WEBHOOK_SECRET`.
3. Sin ese secreto, la función responde 401 a todo y no registra nada.

## 4. El correo de Supabase Auth (registro y recuperación)
1. En Supabase → **Authentication → Emails → SMTP Settings**, activa **Custom SMTP**:

| Campo | Valor |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Una llave de Resend (puede ser otra solo para Auth). |
| Sender email | `citas@yapoin.com` |
| Sender name | `Yapoin` |

2. Con el SMTP propio ya se pueden editar las plantillas (pendiente desde la 3.5, `docs/operacion/configurar-barberias-dev.md`):
   - **Reset password:** pega `supabase/templates/recovery.html`, con el asunto "Recupera tu acceso";
   - **Confirm signup:** pega `supabase/templates/confirmation.html`, con el asunto "Confirma tu correo".
3. El SMTP de SES que tenía `barberias-dev` se reemplaza por este.

## 5. Comprobar
1. Regístrate con un correo nuevo en `www.yapoin.com`. El correo de confirmación debe llegar desde `citas@yapoin.com` a la bandeja de entrada, no a spam. Prueba en Gmail y en Outlook.
2. **Un correo de la cola:** en el SQL Editor de `barberias-dev`, encola un aviso para una barbería de prueba tuya:
   ```sql
   select private.enqueue_notification('<id de la barbería>', 'subscription_expiring', 'prueba-resend-1');
   ```
   En un minuto debe llegar "Tu prueba gratis vence el …" al correo del dueño. En la tabla `notifications` queda `sent`.
3. En Resend → **Emails**, el envío aparece con la etiqueta `notification_id`.

## Si algo falla
- **El correo no sale y la cola dice `http_401` o `http_403`:** la llave está mal o el dominio no está verificado. Los correos esperan y se reintentan solos.
- **`no_template`:** es un tipo de correo sin plantilla todavía (los de citas llegan con la 5.3).
- **Llega a spam:** revisa que SPF, DKIM y DMARC estén verificados en Resend.
