# 0007 Infraestructura

Fecha: 2026-11-05 · Tareas: 1.10 (`docs/tareas/1.10-infraestructura-base.md`), 2.2, 3.5, 5.1, 5.2 y 6.4 · Estado: **Propuesta**. Falta la aprobación del fundador y del compañero de infraestructura.

Complementa la decisión 0006 (esquema de base de datos final), que deja pendiente la aprobación de infraestructura. Reemplaza la tabla "Stack técnico y costos" de la spec en lo que se refiere a hosting, imágenes y anti-abuso.

## Contexto

- **Objetivo:** operar el producto al menor costo posible, sin servidores propios y con una o dos personas.
- **Punto de partida:** Next.js 16 (App Router, `cacheComponents`, Server Actions y `proxy.ts`), Supabase y Vercel Pro como vista previa por PR. Aún no hay producción ni datos reales.
- **Decisiones que esta propuesta da por cerradas:**
  - el correo es el único canal de mensajes, con Amazon SES (decisión 0006, correo único canal);
  - el esquema final, el plan único de 25.000 COP por sede y la retención de 90 días de la cola (decisión 0006, esquema final).
- **Fuente de comparación:** el archivo `infraestructura-plataforma-agendamiento.md` que trajo el fundador. Se toman sus buenas prácticas y se señala dónde no se siguen.

**Regla de prioridad:** si algo aquí contradice la spec o la decisión 0006, ganan ellas, salvo en hosting, imágenes y anti-abuso, donde esta decisión propone el cambio.

## Supuestos de dimensionamiento

| Concepto | Por sede | 10 sedes | 100 sedes | 1.000 sedes |
| --- | --- | --- | --- | --- |
| Barberos | ~4 | 40 | 400 | 4.000 |
| Citas al mes (~10 por barbero al día, decisión 0006) | ~1.200 | 12.000 | 120.000 | 1,2 M |
| Correos al mes (confirmación + recordatorio, +5% de avisos) | ~2.500 | 25.000 | 250.000 | 2,5 M |
| Visitas a la página pública (100 al día) | ~3.000 | 30.000 | 300.000 | 3 M |
| Peticiones a la app (~4 por visita, sin contar archivos estáticos) | ~12.000 | 120.000 | 1,2 M | 12 M |
| Imágenes (logo, portada y fotos en WebP) | ~1 MB | 10 MB | 100 MB | 1 GB |

Estas cifras son estimaciones, no mediciones. La tarea 1.10 mide el CPU por petición y la latencia, y el piloto mide las visitas reales.

## Arquitectura

```text
Celular (cliente, dueño, barbero)
  │
  ▼
Cloudflare  ── DNS, SSL, Turnstile, regla de límite por IP
  ├── Workers (OpenNext): la app Next.js
  │     ├── archivos estáticos: gratis e ilimitados
  │     └── páginas, Server Actions y rutas: Workers Paid
  └── R2: imágenes públicas en img.<dominio>
  │
  ▼ HTTPS (supabase-js / PostgREST)
Supabase Pro ── Postgres + RLS, Auth, pg_cron, Edge Functions
  │
  ▼ HTTPS (API de SES v2) y SMTP para Auth
Amazon SES ── correos de citas, avisos y Auth
```

### Decisiones por pieza

| # | Pieza | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- | --- |
| 1 | App web | **Next.js actual en Cloudflare Workers con OpenNext**, condicionado a la prueba de la tarea 1.10. Si la prueba falla, **Vercel Pro**. | Reescribir como SPA estática; seguir en Vercel; un VPS | Cloudflare sirve gratis lo estático y cobra US$5 al mes con 10 M de peticiones. Vercel Pro incluye solo 1 M de peticiones de CDN. Una SPA ahorraría pocos dólares más, pero obliga a rehacer el login y las acciones ya probadas, y empeora las vistas previas del link al compartirlo. |
| 2 | Base de datos, Auth y API | **Supabase Pro** con cómputo **Micro**, cubierto por el crédito de US$10. Subir a Small o Medium cuando el CPU pase del 70% sostenido. | Supabase gratis; Cloud SQL; Postgres propio | Gratis no tiene copias de seguridad y se pausa sin uso. Pro trae copias diarias con 7 días de retención. |
| 3 | Región | **`us-east-1`** para Supabase y SES, a confirmar con la medición de la 1.10 frente a `sa-east-1`. El Worker usa Smart Placement para correr cerca de la base de datos. | Elegir sin medir | La región de Supabase no se cambia fácil una vez creada. |
| 4 | Imágenes | **Cloudflare R2**, bucket público con dominio `img.<dominio>` y caché de Cloudflare. | Supabase Storage | R2 no cobra la transferencia de salida y es gratis hasta 10 GB. En Supabase, las imágenes de las páginas públicas consumirían los 250 GB de salida del plan. |
| 5 | Correo | **Amazon SES** (`us-east-1`), por la API v2, desde una Edge Function que corre cada minuto con pg_cron. Auth envía por SMTP de SES. | Resend; API de Gmail; enviar desde el Worker | US$0,10 por cada 1.000 correos y sin mensualidad. Gmail tiene un tope de unos 500 al día. La cola, el reintento y la purga viven junto a la base de datos (decisión 0006, migración 11). |
| 6 | Tareas programadas | **pg_cron**: envío de la cola cada minuto, purga diaria de la cola y limpieza de cuentas sin confirmar (5.5). | Cron de Vercel o de Cloudflare | Quedan en el mismo lugar que los datos y sus pruebas. |
| 7 | Anti-abuso | **Turnstile** en registro, ingreso, recuperación y reserva, con el captcha de Supabase Auth activado. **Una regla de límite por IP** de Cloudflare sobre las rutas de escritura, y límites por correo e IP en la función de reserva. | Sin captcha; límites solo en Supabase | Supabase Auth solo ve la IP del servidor (decisión 0006, correo único canal). Cloudflare ve la IP real: Turnstile es gratis, y el plan gratis permite 1 regla de límite por IP con ventana de 10 s. |
| 8 | Agenda en vivo (4.5) | **Consultar cada 30–60 s** solo en la vista de hoy, pausado con la pestaña en segundo plano. | Supabase Realtime | Pro incluye 500 conexiones simultáneas. Consultar cada minuto cuesta casi nada y no tiene tope de conexiones. |
| 9 | Caché | Perfil público de cada sede con caché corta (la 1.10 decide entre `use cache` con etiquetas y `Cache-Control`). **Disponibilidad y reserva siempre en vivo.** No se guardan en caché respuestas con error. | Sin caché | Con 100 visitas al día por sede, la base de datos recibe una consulta de perfil cada pocos minutos, no 100. |
| 10 | Observabilidad | **Sentry** gratis, registros de Workers, reportes y Advisors de Supabase, métricas de SES y un monitor de disponibilidad gratis (UptimeRobot o Better Stack, a confirmar). | Herramientas pagas | Suficiente para el piloto. |
| 11 | Copias de seguridad | Las diarias de Pro, más un `pg_dump` semanal desde GitHub Actions a un bucket privado de R2, con 8 semanas de retención. Un simulacro de restauración antes del piloto. | PITR (US$100 o más al mes) | Una copia fuera de Supabase cuesta casi nada. |

### Lo que no se toma del archivo de referencia

- **App 100% estática:** ver el punto 1.
- **Clientes por teléfono y `wa.me`:** contradice la decisión 0006. El cliente se reconoce por su correo.
- **Un correo por cita:** la spec envía confirmación y recordatorio. A 1.000 sedes son unos US$250 al mes, no 85.
- **Su función de disponibilidad:** ignora el horario de la sede, los festivos, los cierres generales, la anticipación mínima, la fase de la suscripción y los varios servicios. La disponibilidad se hace en la 3.1, con el contrato de la sección 3 de la decisión 0006.
- **Su Worker de caché:** guarda también las respuestas con error. Aquí no se guardan.
- **Cuentas para todos los barberos:** la spec usa links privados. No cambia el costo.

## Componentes en detalle

### App en Cloudflare Workers

- **Despliegue:** `@opennextjs/cloudflare` y `wrangler`, siempre desde GitHub Actions en Linux. OpenNext no garantiza Windows: en el computador solo se usa `pnpm dev`.
- **Riesgo principal:** OpenNext dice que el middleware de Node aún no está soportado, y en Next 16 `proxy.ts` corre en Node. La app lo usa para refrescar la sesión en panel, admin y cuentas. La 1.10 prueba, en este orden:
  1. `proxy.ts` tal cual, por si la versión vigente de OpenNext ya lo soporta;
  2. `middleware.ts` en el runtime edge, que Next 16 desaconseja pero conserva;
  3. refrescar la sesión dentro de las páginas y acciones, sin proxy.
- **Límites de Workers Paid:** 30 s de CPU por petición (hasta 5 min), 128 MB de memoria y un tamaño máximo del Worker (OpenNext dice 10 MiB comprimido; la página de límites de Cloudflare, 64 MiB sin comprimir). La 1.10 mide el tamaño real.
- **Caché de Next:** si se usa revalidación por etiquetas, OpenNext necesita un tag cache en D1 o Durable Objects, y R2 para la caché incremental. Su costo se confirma en la 1.10.
- **Vistas previas:** una versión del Worker por PR, apuntando a `barberias-dev`. Se protegen con Cloudflare Access, o quedan públicas con datos de prueba (decisión abierta 4).
- **Sentry:** confirmar en la 1.10 qué SDK funciona con OpenNext.

### Supabase

- **Proyectos:**
  - `barberias-prod`: Pro, cómputo Micro, Spend Cap activo.
  - `barberias-dev`: gratis, en una organización aparte, porque en Pro cada proyecto suma su propio cómputo.
- **Ajustes de Auth:** confirmación de correo, cambio seguro de contraseña, código de 10 caracteres, plantillas en español, captcha Turnstile, SMTP de SES y su límite de envíos subido. La lista vive en `docs/operacion/configurar-barberias-dev.md` y se repite en producción en la 6.4.
- **Edge Functions:** Pro incluye 2 M de invocaciones al mes y cobra US$2 por millón adicional. El envío cada minuto son unas 43.000 al mes.
- **Disco:** Pro incluye 8 GB y cobra US$0,125 por GB adicional. A 1.000 sedes, el esquema crece unos 17–19 GB al año (decisión 0006): unos US$2–4 al mes en el primer año.
- **Conexión:** la app usa PostgREST por HTTPS, así que no necesita pooler.

### Imágenes en R2

- **Buckets:**
  - imágenes públicas, uno por ambiente;
  - copias de seguridad, privado.
- **Subida:**
  1. El navegador comprime a WebP: máximo 1.200 px y menos de 100 KB; las fotos de barbero, 400 px.
  2. Una Server Action verifica que el usuario sea miembro de la sede y entrega una URL firmada de subida.
  3. La base de datos guarda solo la llave del objeto (`logo_path`, `cover_photo_path` y `photo_path`).
- **Llaves:** `<barbershop_id>/<tipo>/<uuid>.webp`, así que reemplazar una imagen crea una llave nueva y la caché nunca muestra la vieja. La anterior se borra al reemplazarla, y una limpieza mensual borra las huérfanas.
- **Costo:** gratis hasta 10 GB, 1 M de escrituras y 10 M de lecturas al mes, sin cobro de salida. Las lecturas pasan por la caché de Cloudflare.

### Correo con SES

- **Dominio:** se verifica con SPF, DKIM y DMARC, y se usa un remitente del dominio, por ejemplo `citas@<dominio>`.
- **Salir del sandbox:** el sandbox solo envía a correos verificados, hasta 200 al día y 1 por segundo. Amazon responde la solicitud en hasta 96 horas, y puede pedir más información. Por eso se solicita apenas exista el dominio.
- **Envío:**
  1. La Edge Function toma hasta 50 correos pendientes con `for update skip locked`.
  2. Los envía respetando el límite de la cuenta, que empieza en 14 por segundo.
  3. Marca cada uno como enviado o fallido y reintenta hasta 3 veces. La `dedupe_key` impide duplicados (decisión 0006).
- **Rebotes y quejas:** la lista de supresión de la cuenta de SES deja de enviar a los correos que rebotan o se quejan, sin columnas nuevas. Hay una alerta si los rebotes pasan del 2% o las quejas del 0,1%.
- **Permisos:** un usuario de IAM que solo puede `ses:SendEmail` desde la identidad del dominio. Su llave vive en los secretos de la Edge Function.
- **Contenido:** la confirmación lleva "Agregar a mi calendario" (`.ics`), para que el calendario del cliente también le recuerde la cita.

## Ambientes

| Ambiente | Web | Base de datos | Correo | Imágenes |
| --- | --- | --- | --- | --- |
| Local | `pnpm dev` | Supabase en Docker | Mailpit | Bucket de R2 de desarrollo, o sin imágenes |
| Vista previa | Versión del Worker por PR | `barberias-dev` (gratis) | SES sandbox o el correo de prueba de Supabase | Bucket de desarrollo |
| Producción | Worker en `<dominio>` | `barberias-prod` (Pro) | SES en producción | Bucket de producción en `img.<dominio>` |

## Integración y despliegue (GitHub Actions)

| Cuándo | Qué corre |
| --- | --- |
| Cada PR | `checks` (lint, typecheck, unitarias y build), `database` (pgTAP y tipos) y `e2e`, como hoy. Además, el build de OpenNext y la subida de una versión de vista previa del Worker. |
| Merge a `main` (desde la 6.4) | Migraciones a `barberias-prod` con `supabase db push`, y luego el despliegue del Worker de producción. Si la migración falla, no se despliega. |
| Cada semana | `pg_dump` de producción al bucket privado de R2. |

- **Solo CI toca la nube:** el hook `guard.mjs` sigue bloqueando los comandos remotos en el computador.
- **Secretos de GitHub:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` de producción. Los crea el fundador.

**Dónde vive cada secreto:**

| Secreto | Dónde | Nunca en |
| --- | --- | --- |
| Llave publicable de Supabase | Variables del Worker | — (es pública) |
| Llave secreta de Supabase | Secretos del Worker, solo si una acción la necesita | Navegador, repositorio |
| Llave de SES | Secretos de la Edge Function | Worker, navegador, repositorio |
| Llave de R2 para firmar subidas | Secretos del Worker | Navegador, repositorio |
| Secreto de Turnstile | Supabase Auth y secretos del Worker | Navegador, repositorio |

## Costos mensuales estimados

Precios de lista consultados el 2026-11-05. Cifras en US$, a 4.000 COP por dólar.

| Pieza | 10 sedes | 100 sedes | 1.000 sedes |
| --- | --- | --- | --- |
| Cloudflare Workers Paid | 5 | 5 | ≈8 |
| Supabase Pro (Micro con su crédito) | 25 | 25 | 30–80 (Small o Medium, y disco) |
| Amazon SES | ≈2,5 | ≈25 | ≈250 |
| R2, Turnstile, DNS y Sentry | 0 | 0 | 0 |
| Dominio | ≈3 | ≈3 | ≈3 |
| **Total** | **≈35** | **≈58** | **≈290–340** |
| Ingreso a 25.000 COP por sede | ≈62 | ≈625 | ≈6.250 |
| Infraestructura sobre el ingreso | ≈56% | ≈9% | ≈5% |

- **Punto de equilibrio:** unas 6 sedes pagando.
- **Si la 1.10 falla y se queda en Vercel Pro:** unos US$15 más al mes con 10 sedes, unos US$35 más con 100 y unos US$140 más con 1.000. Supone unas 10 peticiones de CDN por visita y el nivel de CDN que corresponda.
- **El costo que crece es el correo.** Si hace falta bajarlo, se puede omitir el recordatorio en las citas reservadas para el mismo día, que ya reciben la confirmación. Es una decisión de negocio y no se aplica sin el fundador.

## Cuándo escalar

| Métrica (dónde se ve) | Umbral | Acción |
| --- | --- | --- |
| CPU de la base de datos (Supabase → Reports) | >70% sostenido en las horas pico | Subir a Small (≈US$15) o Medium (≈US$60) |
| Disco (Supabase → Usage) | >6 GB | Revisar los índices y aceptar el costo por GB |
| Salida de Supabase | >200 GB al mes | Revisar la caché del perfil |
| Peticiones de Workers | >9 M al mes | Aceptar el excedente (US$0,30 por millón) |
| Rebotes y quejas de SES | >2% y >0,1% | Revisar los correos inválidos y las plantillas |
| Invocaciones de Edge Functions | >1,8 M al mes | Revisar la frecuencia del envío |

## Cuentas que crea el fundador

| Cuenta | Cuándo | Costo |
| --- | --- | --- |
| Cloudflare | Tarea 1.10 | Gratis para empezar; Workers Paid (US$5) al pasar a producción |
| Dominio | Antes de la 5.2 | ≈US$18–37 al año; revisar la renovación, no la promoción |
| AWS (SES) y la solicitud de salida del sandbox | Apenas exista el dominio | Por uso |
| Sentry y el monitor de disponibilidad | Tarea 6.4 | Gratis |

## Plan de adopción

| Tarea | Infraestructura que llega |
| --- | --- |
| 1.10 (nueva, antes de la fase 2) | Prueba de OpenNext y vista previa en Workers. Si pasa, Cloudflare reemplaza las vistas previas de Vercel. Si no, se documenta por qué y se sigue en Vercel. |
| 2.2 | Subida de fotos a R2 con URL firmada |
| 3.2 | Caché del perfil público |
| 3.5 | Turnstile, regla de límite por IP y límites de reserva |
| 4.5 | Consulta periódica de la agenda de hoy |
| 5.1 | pg_cron, la cola, la purga y la Edge Function de envío |
| 5.2 | Dominio verificado en SES, salida del sandbox y SMTP de Auth |
| 6.4 | `barberias-prod`, Workers Paid, dominio en la app, migraciones desde CI, Sentry, monitor, `pg_dump` semanal y simulacro de restauración |

## Riesgos

- **OpenNext y `proxy.ts`:** es el único riesgo que puede cambiar la decisión 1. Lo resuelve la 1.10, y el plan B es Vercel Pro.
- **Latencia:** si la región elegida queda lejos de Colombia, cada consulta tarda más. Lo mide la 1.10.
- **Salida del sandbox de SES:** si Amazon la niega o la demora, se frena la fase 5. Se solicita temprano, con el dominio ya verificado.
- **Entrega en Gmail y Outlook:** depende del dominio y de las quejas. Lo cubren SPF, DKIM, DMARC y la supresión de SES.
- **Un solo proveedor para DNS, app e imágenes:** si Cloudflare falla, falla todo menos la base de datos. Se acepta por costo.
- **Precios:** son precios de lista que pueden cambiar. Se revisan antes de crear cada cuenta.

## Decisiones abiertas

1. **Región:** `us-east-1` o `sa-east-1`. Se decide con la medición de la 1.10.
2. **Plan B:** si la 1.10 falla, se queda en Vercel Pro y se vuelve a evaluar al llegar a 100 sedes. ¿Se confirma?
3. **Nombre y dominio:** sigue pendiente en la spec, y SES lo necesita antes de la 5.2.
4. **Vistas previas:** ¿se protegen con Cloudflare Access, que es gratis para pocos usuarios, o quedan públicas con datos de prueba?
5. **Recordatorio en citas del mismo día:** ¿se envía, o basta la confirmación? Solo importa para el costo a escala.

## Hallazgo de numeración

Hay dos decisiones `0006`: `0006-correo-unico-canal.md` y `0006-esquema-base-de-datos-final.md`. Esta toma el número 0007 para no agregar otro choque. Conviene renumerar una de las dos en la tarea 1.9.

## Fuentes

- Cloudflare: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/), [Pages y archivos estáticos](https://developers.cloudflare.com/pages/functions/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [Turnstile](https://developers.cloudflare.com/turnstile/plans/) y [reglas de límite por IP](https://developers.cloudflare.com/waf/rate-limiting-rules/).
- OpenNext: [soporte de Next.js](https://opennext.js.org/cloudflare) y [caché](https://opennext.js.org/cloudflare/caching). Next.js: [`proxy.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
- Vercel: [Pro](https://vercel.com/docs/plans/pro-plan), [CDN](https://vercel.com/docs/pricing/flat-rate-cdn) y [funciones](https://vercel.com/docs/functions/usage-and-pricing).
- Supabase: [precios](https://supabase.com/pricing), [cómputo](https://supabase.com/docs/guides/platform/compute-and-disk), [Edge Functions](https://supabase.com/docs/guides/functions/pricing), [captcha](https://supabase.com/docs/guides/auth/auth-captcha) y [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Amazon SES: [precios](https://aws.amazon.com/ses/pricing/) y [salida del sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).
