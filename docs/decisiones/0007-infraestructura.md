# 0007 Infraestructura

Fecha: 2026-11-05, revisión 2 del mismo día · Tareas: 1.10 (`docs/tareas/1.10-infraestructura-base.md`), 2.2, 3.5, 4.5, 5.1, 5.2, 5.3 y 6.4 · Estado: **aceptada por el fundador** (2026-11-05).

Complementa la decisión 0006 (esquema de base de datos final), que dejaba pendiente la aprobación de infraestructura. Reemplaza la tabla "Stack técnico y costos" de la spec y el precio de SES de la decisión 0006 (correo único canal, punto 2 y "Costos"). El procedimiento paso a paso para crear las cuentas está en `docs/operacion/infraestructura-produccion.md`.

> **Revisión 2, 2026-11-05: decisiones finales del fundador.** Cambios frente a la propuesta (revisión 1, commit `860f274`):
>
> 1. **Hosting en Vercel Pro**, no en Cloudflare Workers. La estabilidad del lanzamiento pesa más que el ahorro (unos US$112 al mes con 1.000 sedes). En OpenNext, el soporte de `proxy.ts` (middleware de Node) está marcado como **experimental**, y vinext está en beta. Se vuelve a evaluar con los criterios de "Cuándo escalar".
> 2. **Cloudflare solo para DNS, registro del dominio y Turnstile**, con los registros en modo "DNS only", como recomienda Vercel. Sin proxy de Cloudflare, sin R2 y sin reglas de límite de Cloudflare, porque necesitan el proxy.
> 3. **Imágenes en Supabase Storage**, como dice la spec. R2 queda como opción si la salida en caché de Supabase se acerca a su cuota.
> 4. **Dos correos por cita:** uno al cliente y uno al barbero. Se descarta el resumen diario por correo al barbero: su resumen vive en la app ("Mi agenda").
> 5. **Precio de SES corregido:** las cuentas nuevas quedan en el plan Essentials, a US$0,16 por cada 1.000 correos. Los US$0,10 son la tarifa "a la carta", que queda como decisión abierta.
> 6. **Volumen de cálculo:** 4 barberos por sede, 10 servicios por barbero al día y 30 días al mes, para no quedarse corto.

## Contexto

- **Objetivo:** operar el producto al menor costo posible, **estable desde el lanzamiento**, sin servidores propios, con una o dos personas, y escalable hasta **1.000 sedes** en el mediano plazo.
- **Restricciones del fundador:** sin pasarela de pagos (pagos por transferencia, decisión 0006) y sin WhatsApp como canal (decisión 0006, correo único canal).
- **Punto de partida:** Next.js 16 (App Router, `cacheComponents`, Server Actions y `proxy.ts`), Supabase, y Vercel con vista previa por PR. Aún no hay producción ni datos reales.
- **Fuentes:** solo documentación oficial de cada proveedor, consultada el 2026-11-05 (sección "Fuentes"). Lo que la documentación no confirma queda marcado "a confirmar".

**Regla de prioridad:** si algo aquí contradice la spec, gana esta decisión en infraestructura y costos. En reglas de negocio gana la spec, salvo las decisiones del fundador anotadas en la sección "Discrepancias".

## Supuestos de dimensionamiento

| Concepto | Por sede | 50 sedes | 600 sedes | 1.000 sedes |
| --- | --- | --- | --- | --- |
| Barberos | 4 | 200 | 2.400 | 4.000 |
| Citas al día (10 por barbero) | 40 | 2.000 | 24.000 | 40.000 |
| Citas al mes (30 días) | 1.200 | 60.000 | 720.000 | 1,2 M |
| Correos al mes (2 por cita) | 2.400 | 120.000 | 1,44 M | 2,4 M |
| Páginas vistas al mes | 9.000 | 450.000 | 5,4 M | 9 M |
| Peticiones de CDN al mes (3 por página vista) | 27.000 | 1,35 M | 16,2 M | 27 M |
| Invocaciones de funciones (1,5 por página vista) | 13.500 | 675.000 | 8,1 M | 13,5 M |
| Crecimiento de la base de datos (con índices) | ~18 MB al año | ~0,9 GB al año | ~11 GB al año | ~17–19 GB al año |

**Cómo se estimó:**

- **Páginas vistas:** 5 por cita del cliente (perfil, servicios, barbero, hora y confirmación), más 20 al día por cada dueño o barbero en su panel o en "Mi agenda": 200 + 100 = 300 al día por sede.
- **Funciones de Vercel:** 30 ms de CPU por invocación, 0,2 s de vida con 1 GB de memoria y concurrencia de 3.
- **Base de datos:** la decisión 0006 estima 17–19 GB al año con 1.000 sedes, contando citas, líneas de servicio, historial, cola e índices. Las otras columnas son proporcionales.
- **Salida de imágenes:** ~200 KB por visitante nuevo (logo, portada y fotos en WebP). Con caché del navegador, ~240 GB al mes con 1.000 sedes.

Son estimaciones, no mediciones. El piloto mide las visitas y el CPU reales, y esta decisión se recalcula con ellos (sección "Cuándo escalar").

## Arquitectura

```text
Celular (cliente, dueño, barbero)
  │  DNS: Cloudflare (solo DNS, sin proxy)
  ▼
Vercel Pro ── Next.js (páginas, Server Actions, proxy.ts)
  │            CDN de Vercel para lo estático · funciones en iad1 (Washington)
  │            Turnstile (widget de Cloudflare) en los formularios
  ▼ HTTPS (supabase-js / PostgREST)
Supabase Pro (us-east-1) ── Postgres + RLS, Auth, Storage, pg_cron, Edge Functions
  │
  ▼ API de SES v2 (cola) y SMTP (Auth)
Amazon SES (us-east-1) ── correos de citas, avisos y Auth
```

## Decisión

| # | Pieza | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- | --- |
| 1 | App web | **Vercel Pro** (US$20 al mes, 1 asiento, US$20 de crédito de uso). En desarrollo y vistas previas se sigue en Hobby; se pasa a Pro en la 6.4, antes de recibir clientes. | Cloudflare Workers con OpenNext o vinext; un VPS | Next.js corre en Vercel sin adaptador, y CI, vistas previas y despliegues ya funcionan ahí. Hobby no permite uso comercial. En OpenNext, `proxy.ts` es experimental, y la app lo usa para proteger `/panel` y `/admin`. |
| 2 | Región | **Funciones en `iad1`** (Washington) y **Supabase y SES en `us-east-1`**. | São Paulo (`gru1`, `sa-east-1`) | Vercel recomienda las funciones cerca de la base de datos, y cada página hace varias consultas. En Vercel, `gru1` cuesta 73% más (US$0,221 frente a US$0,128 por hora de CPU). Lo estático sale del CDN más cercano al usuario. La región de Supabase no se cambia fácil una vez creada. |
| 3 | Base de datos, Auth y API | **Supabase Pro** (US$25 al mes, con US$10 de crédito de cómputo que cubre Micro). Cómputo por etapa, estimado: **Micro** hasta ~300 sedes, **Small** (US$15) cerca de 600 y **Medium** (US$60) cerca de 1.000, o antes si lo pide la métrica de CPU. | Supabase gratis; Postgres propio | El plan gratis se pausa tras una semana sin uso y no tiene copias de seguridad. Pro no se pausa, guarda copias diarias por 7 días e incluye 8 GB de disco, 250 GB de salida, 250 GB de salida en caché, 100.000 usuarios activos y 2 M de invocaciones de Edge Functions. Solo los dueños tienen cuenta, así que el tope de usuarios no se acerca. |
| 4 | Proyecto de desarrollo | **`barberias-dev` en una organización gratis aparte.** | Dentro de la organización Pro | En Pro, cada proyecto adicional suma US$10 al mes. El plan gratis permite 2 proyectos activos; si `barberias-dev` se pausa por falta de uso, se reanuda desde el panel. |
| 5 | Imágenes | **Supabase Storage**, con llaves inmutables y caché larga. | Cloudflare R2 | Mantiene una sola plataforma de datos. Con imágenes en WebP y caché, la salida estimada cabe en los 250 GB en caché de Pro. R2 se evalúa si se acerca a la cuota. |
| 6 | Correo | **Amazon SES en `us-east-1`, plan Essentials** (US$0,16 por cada 1.000 correos, sin cuota fija), aislado en un solo módulo. La cola se envía por la API v2 desde una Edge Function. Auth envía por el SMTP de SES. | Resend; Cloudflare Email Service; correo por defecto de Supabase | Con 2,4 M de correos al mes: SES ≈US$384, Cloudflare Email Service ≈US$844 (en beta) y Resend Scale ≈US$2.160. El correo por defecto de Supabase solo envía al equipo del proyecto, unos 2 por hora y sin garantía. |
| 7 | Correos por cita | **Presupuesto: 2 correos por cita**, uno al cliente y uno al barbero. El resumen del barbero vive en "Mi agenda", sin correo. Cualquier correo adicional por cita necesita una decisión nueva. | Confirmación y recordatorio al cliente, más el aviso al barbero (3 por cita) | Cada correo adicional por cita suma ~US$192 al mes con 1.000 sedes. Decisión del fundador. |
| 8 | Tareas programadas | **pg_cron** para el envío de la cola cada minuto, la purga diaria (90 días, decisión 0006) y la limpieza de cuentas sin confirmar (5.5). La Edge Function envía por lotes. | Vercel Cron; un correo por invocación | El envío cada minuto son ~43.200 invocaciones al mes, dentro de los 2 M de Pro. Una invocación por correo superaría la cuota con 1.000 sedes. |
| 9 | DNS y dominio | **Cloudflare gratis** para el DNS, con los registros de Vercel en modo **"DNS only"**. El dominio se compra en Cloudflare Registrar si el TLD está disponible; si no, en otro registrador con los nameservers en Cloudflare. | Proxy de Cloudflare delante de Vercel | Vercel recomienda conectar directo: el proxy agrega un salto de latencia, dos cachés, otra pieza que puede fallar y pérdida de la IP real del visitante. El DNS de Cloudflare es gratis y sin tope de consultas, y Registrar cobra a costo. |
| 10 | Anti-abuso | **Turnstile** (gratis, modo Managed) en registro, ingreso, recuperación y reserva, con el captcha de Supabase Auth activado con Turnstile. **Límites propios** por correo e IP en la función de reserva, con la IP del visitante que entrega Vercel. **Vercel WAF** para bloquear IP o rutas (Pro: hasta 40 reglas personalizadas). | Reglas de límite de Cloudflare | Las reglas de Cloudflare necesitan el proxy, que se descarta en el punto 9. Supabase Auth solo ve la IP del servidor (decisión 0006, correo único canal), así que el captcha de Auth es el que frena el abuso del registro. |
| 11 | Control de gasto | **Supabase:** Spend Cap activo al lanzar; se apaga antes de llegar al 80% de las cuotas de disco o de salida. **Vercel:** Spend Management con avisos al 50, 75 y 100%, **sin pausar producción**. | Topes duros en todo | Con el Spend Cap activo, Supabase no permite usar más de lo que cubre la cuota (disco, salida, invocaciones) hasta el siguiente ciclo, y eso tumbaría la app. La pausa de Vercel deja la app en error 503 hasta reanudar a mano. |
| 12 | Copias de seguridad | **Las diarias de Pro** (7 días), más un **`pg_dump` semanal** desde GitHub Actions a un bucket privado de S3 en la misma cuenta de AWS, con 8 semanas de retención. Un simulacro de restauración antes del piloto. | PITR | Una copia fuera de Supabase cuesta casi nada. El costo de S3 se confirma en la 6.4. |
| 13 | Agenda en vivo (4.5) | **Consultar cada 30–60 s** solo en la vista de hoy, pausado con la pestaña en segundo plano. | Supabase Realtime | Sin conexiones abiertas que contar. La 4.5 confirma el costo en invocaciones. |
| 14 | Caché | **Perfil público de cada sede con caché corta** (la 3.2 decide entre `use cache` con etiquetas y `Cache-Control`). **Disponibilidad y reserva siempre en vivo.** Nunca se guardan en caché respuestas con error. | Sin caché | Baja las consultas a la base de datos y las invocaciones de funciones. |
| 15 | Portabilidad | **No se usan servicios exclusivos de Vercel** (`@vercel/kv`, `@vercel/blob`, `@vercel/postgres`, `@vercel/edge-config`) ni se lee `vercel.json` desde el código. | Usarlos por comodidad | Deja abierta la salida a Cloudflare Workers u otro hosting sin reescribir. Lo exige un lint (tarea 1.10). |
| 16 | Observabilidad | **Sentry** (plan gratis, a confirmar en la 6.4), registros de Vercel, reportes y Advisors de Supabase, métricas de SES (rebotes y quejas) y un monitor de disponibilidad gratis (a confirmar en la 6.4). | Herramientas pagas | Suficiente para el piloto. |

## Componentes en detalle

### Vercel

- **Plan:** Hobby en desarrollo (las vistas previas no son uso comercial); **Pro desde la 6.4**, antes del piloto.
- **Región:** `regions: ["iad1"]` en `vercel.json` (tarea 1.10). Es la región por defecto para proyectos nuevos, pero fijarla evita que cambie sin revisión.
- **CDN:** Pro incluye 1 M de peticiones de CDN y 1 TB de transferencia. Los niveles fijos son US$20 (10 M), US$100 (50 M) y US$300 (150 M). Si un ciclo pasa de su nivel, Vercel sube de nivel en el siguiente ciclo; un día con picos no cambia la factura.
- **Funciones:** se cobran por uso contra el crédito de US$20: invocaciones a US$0,60 por millón, CPU activa a US$0,128 por hora y memoria a US$0,0106 por GB-hora en `iad1`. La CPU no se cobra mientras la función espera a la base de datos.
- **Variables de entorno:** las de Preview apuntan a `barberias-dev` (`docs/operacion/configurar-barberias-dev.md`). Las de Production, a `barberias-prod`, y solo las crea el fundador.

### Supabase

- **Proyectos:**
  - `barberias-prod`: organización Pro, `us-east-1`, cómputo Micro, Spend Cap activo.
  - `barberias-dev`: organización gratis aparte, la región que ya tiene.
- **Ajustes de Auth en producción:** confirmación de correo, cambio seguro de contraseña, código de 10 caracteres, plantillas en español, captcha con Turnstile, SMTP de SES y su límite de envíos subido (con SMTP propio arranca en 30 por hora). La lista vive en `docs/operacion/configurar-barberias-dev.md` y se repite en producción en la 6.4.
- **Disco:** Pro incluye 8 GB y cobra US$0,125 por GB adicional. Con 1.000 sedes, el primer año suma unos US$2–4 al mes (decisión 0006). Antes de llegar a 6,5 GB se apaga el Spend Cap (punto 11).
- **Cómputo:** tamaños oficiales Micro (1 GB, ~US$10), Small (2 GB, ~US$15), Medium (4 GB, ~US$60), Large (8 GB y 2 vCPU dedicadas, ~US$110). El cómputo no lo cubre el Spend Cap, así que subir de tamaño no lo bloquea.
- **Conexión:** la app usa PostgREST por HTTPS, así que no necesita pooler. Si alguna función se conecta directo a Postgres, usa el pooler (Micro: 200 clientes; Medium: 600).

### Imágenes en Supabase Storage

- **Buckets:** uno público para imágenes de las sedes y barberos, por ambiente.
- **Subida:**
  1. El navegador comprime a WebP: máximo 1.200 px y menos de 100 KB; las fotos de barbero, 400 px.
  2. Una Server Action verifica que el usuario sea miembro de la sede y entrega una URL firmada de subida.
  3. La base de datos guarda solo la llave del objeto.
- **Llaves:** `<barbershop_id>/<tipo>/<uuid>.webp`. Reemplazar una imagen crea una llave nueva, así que la caché nunca muestra la vieja, y se puede servir con caché larga. La anterior se borra al reemplazarla, y una limpieza mensual borra las huérfanas.
- **Sin optimización de imágenes de Vercel** (`next/image` con `unoptimized` o un loader propio), porque se cobra por transformación y las imágenes ya llegan comprimidas.

### Correo con SES

- **Dominio:** se verifica con DKIM, SPF y DMARC, y se envía desde un remitente del dominio (por ejemplo, `citas@<dominio>`).
- **Salir del sandbox:** el sandbox solo envía a correos verificados, hasta 200 al día y 1 por segundo. La solicitud pide tipo de correo (**Transactional**), URL del sitio y contactos, y Amazon responde en hasta 96 horas, o más si pide información. Se solicita apenas el dominio esté verificado.
- **Cuota:** después del sandbox, la cuota diaria y la velocidad dependen de cada cuenta, y se piden aumentos por región. Con 1.000 sedes se necesitan ~80.000 correos al día. Se pide el aumento cuando el uso pase del 60% de la cuota.
- **Envío:**
  1. La Edge Function toma hasta 50 correos pendientes con `for update skip locked`.
  2. Envía **una llamada por destinatario**, como recomienda AWS, respetando la velocidad de la cuenta.
  3. Marca cada uno como enviado o fallido y reintenta hasta 3 veces. La `dedupe_key` impide duplicados (decisión 0006).
- **Rebotes y quejas:** la lista de supresión de SES deja de enviar a los correos que rebotan o se quejan. Alerta si los rebotes pasan del 2% o las quejas del 0,1%.
- **Permisos:** un usuario de IAM que solo puede `ses:SendEmail` desde la identidad del dominio. Su llave vive en los secretos de la Edge Function.
- **Plan de SES:** Essentials por defecto. Si al abrir la cuenta AWS permite elegir la tarifa "a la carta" (US$0,10 por cada 1.000), se usa esa (decisión abierta 1).

## Ambientes

| Ambiente | Web | Base de datos | Correo | Imágenes |
| --- | --- | --- | --- | --- |
| Local | `pnpm dev` | Supabase en Docker | Mailpit | Storage local |
| Vista previa | Vercel (Hobby hasta la 6.4), una URL por PR | `barberias-dev` (organización gratis) | Correo de prueba de Supabase, y SES en sandbox desde la 5.2 | Storage de `barberias-dev` |
| Producción | Vercel Pro en `<dominio>` | `barberias-prod` (Pro, `us-east-1`) | SES en producción | Storage de `barberias-prod` |

## Integración y despliegue (GitHub Actions)

| Cuándo | Qué corre |
| --- | --- |
| Cada PR | `checks` (lint, typecheck, unitarias y build), `database` (pgTAP y tipos) y `e2e`, como hoy. Vercel publica la vista previa. |
| Merge a `main` (desde la 6.4) | Migraciones a `barberias-prod` con `supabase db push`, y luego el despliegue de producción de Vercel. Si la migración falla, no se despliega. |
| Cada semana (desde la 6.4) | `pg_dump` de producción al bucket privado de S3. |

- **Solo CI toca la nube:** el hook `guard.mjs` sigue bloqueando los comandos remotos en el computador.
- **Secretos de GitHub (los crea el fundador):** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` y el `project-ref` de producción; la llave de AWS para el `pg_dump` (solo `s3:PutObject` en ese bucket).

**Dónde vive cada secreto:**

| Secreto | Dónde | Nunca en |
| --- | --- | --- |
| Llave publicable de Supabase | Variables de entorno de Vercel | — (es pública) |
| Llave secreta de Supabase | Variables de Vercel marcadas como sensibles, solo si una acción la necesita | Navegador, repositorio |
| Llave de SES (envío) | Secretos de la Edge Function | Vercel, navegador, repositorio |
| Usuario y clave SMTP de SES | Configuración de Auth de Supabase | Repositorio |
| Secreto de Turnstile | Supabase Auth y variables sensibles de Vercel | Navegador, repositorio |
| Llave de AWS para el `pg_dump` | Secretos de GitHub | Repositorio, Vercel |

## Costos mensuales estimados

Precios de lista consultados el 2026-11-05, en US$, sin impuestos (Vercel los suma según la dirección de facturación). TRM de referencia: 3.183 pesos por dólar (3 de noviembre de 2026); se recalcula con la TRM del mes.

| Pieza | 50 sedes | 600 sedes | 1.000 sedes |
| --- | --- | --- | --- |
| Supabase Pro | 25 (Micro) | ≈30 (Small) | ≈76 (Medium y disco) |
| Vercel Pro | ≈40 (nivel de CDN de US$20) | ≈120 (nivel de US$100) | ≈125 (nivel de US$100 y ≈US$5 de funciones) |
| Amazon SES Essentials (2 correos por cita) | ≈19 | ≈230 | ≈384 |
| Cloudflare (DNS y Turnstile) | 0 | 0 | 0 |
| **Total** | **≈84** | **≈380** | **≈585** |
| Total en pesos | ≈268.000 | ≈1,21 M | ≈1,86 M |
| Ingreso a 25.000 COP por sede | 1,25 M | 15 M | 25 M |
| **Infraestructura sobre el ingreso** | **≈21%** | **≈8,1%** | **≈7,4%** |
| Costo por sede al mes | ≈5.360 COP | ≈2.020 COP | ≈1.860 COP |

- **No incluye** el dominio (pago anual, a costo en Cloudflare Registrar) ni la copia semanal en S3.
- **Punto de equilibrio:** el costo fijo de Supabase y Vercel (~US$65 al mes) se cubre con unas 9 sedes pagando 25.000 COP.
- **El correo es ~2/3 del costo a escala.** Con la tarifa "a la carta" de SES, el total con 1.000 sedes bajaría a ≈US$441. Los clientes sin correo no reciben nada, así que el costo real será algo menor.
- **El ingreso usa 25.000 COP por sede como piso** (decisión 0006, plan único). Un plan superior para sedes grandes solo baja el porcentaje.

**Alternativas de correo, con 2,4 M al mes:**

| Proveedor | Precio de lista | Costo |
| --- | --- | --- |
| **Amazon SES Essentials** | US$0,16 por cada 1.000 | **≈US$384** |
| Amazon SES a la carta | US$0,10 por cada 1.000 | ≈US$240 (si AWS la permite) |
| Cloudflare Email Service (beta) | 3.000 incluidos, luego US$0,35 por cada 1.000, más Workers Paid | ≈US$844 |
| Resend Scale | US$90 con 100.000, luego US$0,90 por cada 1.000 | ≈US$2.160 |

**Alternativa de hosting evaluada:** Cloudflare Workers costaría ≈US$5–14 al mes en lugar de US$40–125 (archivos estáticos gratis, 10 M de peticiones incluidas y US$0,30 por millón adicional), unos US$112 menos con 1.000 sedes (≈1,4% del ingreso). Se descarta por estabilidad (punto 1).

## Cuándo escalar o revisar

| Métrica (dónde se ve) | Umbral | Acción |
| --- | --- | --- |
| CPU de la base de datos (Supabase → Reports) | >70% sostenido en horas pico | Subir a Small, Medium o Large |
| Disco (Supabase → Usage) | >6,5 GB | Apagar el Spend Cap y aceptar el costo por GB |
| Salida sin caché de Supabase | >200 GB al mes | Revisar la caché del perfil público; apagar el Spend Cap |
| Salida en caché de Supabase (imágenes) | >200 GB al mes | Evaluar Cloudflare R2 para las imágenes |
| Peticiones de CDN de Vercel | Cambio de nivel | Revisar que lo estático tenga caché; aceptar el nivel |
| Gasto por uso de Vercel | >US$100 al mes | Volver a evaluar Cloudflare Workers, si para entonces el soporte de `proxy.ts` en OpenNext ya no es experimental |
| Invocaciones de Edge Functions | >1,8 M al mes | Revisar el tamaño de los lotes del envío |
| Cuota diaria de SES | >60% de uso | Pedir aumento de cuota en `us-east-1` |
| Rebotes y quejas de SES | >2% y >0,1% | Revisar los correos inválidos y las plantillas |
| Infraestructura sobre el ingreso | >10% después de 100 sedes | Revisar precios o el presupuesto de correos |

Se revisa cada mes con las facturas reales, y esta decisión se actualiza si cambia una pieza.

## Plan de ejecución

| Orden | Qué | Quién | Tarea | Lista cuando |
| --- | --- | --- | --- | --- |
| 1 | Región `iad1` fija, lint de portabilidad y regla en `CLAUDE.md` | Claude Code | 1.10 | `vercel.json` con `iad1` en `main`; el lint falla al importar `@vercel/*` |
| 2 | Comprar el dominio y pasar el DNS a Cloudflare | Fundador | Antes de la 5.2 | El dominio resuelve desde Cloudflare |
| 3 | Cuenta de AWS, identidad del dominio en SES (`us-east-1`) y solicitud de salida del sandbox | Fundador | Antes de la 5.2 | SES muestra el dominio verificado y la cuenta fuera del sandbox |
| 4 | Widget de Turnstile y captcha de Supabase Auth en `barberias-dev` | Fundador y Claude Code | 3.5 | El registro sin token de Turnstile falla |
| 5 | Imágenes en Supabase Storage con URL firmada | Claude Code | 2.2 | Subir y reemplazar una foto funciona y deja una sola imagen |
| 6 | Cola, pg_cron, purga y Edge Function de envío | Claude Code | 5.1 | Un correo de prueba sale una sola vez, aunque el job corra dos veces |
| 7 | SES en la Edge Function y SMTP de Auth | Fundador y Claude Code | 5.2 | Los correos llegan a la bandeja de entrada de Gmail y Outlook |
| 8 | Supabase `barberias-prod` (Pro, `us-east-1`), Vercel Pro, dominio en la app, variables de producción, alertas de gasto, migraciones desde CI, Sentry, monitor, `pg_dump` semanal y simulacro de restauración | Fundador y Claude Code | 6.4 | La app responde en `<dominio>`, y una copia restaurada abre con los datos |

El paso a paso de lo que hace el fundador está en `docs/operacion/infraestructura-produccion.md`.

## Riesgos aceptados

- **Costo de hosting más alto que Cloudflare:** ~US$35–112 al mes según la etapa, a cambio de estabilidad.
- **Un solo proveedor de datos:** si Supabase falla, fallan la base de datos, Auth e imágenes. Se acepta por costo y simplicidad.
- **Salida del sandbox de SES:** si Amazon la niega o la demora, se frena la fase 5. Se solicita temprano.
- **Entrega en Gmail y Outlook:** depende de la reputación del dominio. La cubren DKIM, SPF, DMARC y la supresión de SES.
- **Estimaciones de tráfico:** si cada visita hace más peticiones de las supuestas, Vercel sube de nivel de CDN antes. Se ve en el panel de uso y se revisa cada mes.
- **Precios de lista:** pueden cambiar. Se revisan antes de crear cada cuenta y cada mes con la factura.

## Discrepancias con la spec

- **Mensajes al cliente:** la spec envía confirmación al reservar y recordatorio 24 h antes, y el aviso al barbero es opcional. El fundador fija **2 correos por cita: uno al cliente y uno al barbero.** Qué correo recibe el cliente (confirmación, recordatorio o uno que haga las dos cosas) lo decide la 5.3, con este presupuesto (decisión abierta 2).
- **Hosting:** la spec dice "Vercel". Se precisa: Hobby en desarrollo, Pro en producción, región `iad1`.

## Decisiones abiertas

1. **Tarifa de SES:** Essentials (US$0,16) por defecto. Si AWS permite elegir "a la carta" (US$0,10), ¿se usa esa? Se confirma al abrir la cuenta.
2. **Correo al cliente (5.3):** con un solo correo, ¿es la confirmación al reservar, el recordatorio, o la confirmación cuando la cita es para el mismo día y el recordatorio en los demás casos?
3. **Nombre y dominio:** sigue pendiente en la spec, y SES lo necesita antes de la 5.2.
4. **Vistas previas:** quedan públicas con datos de prueba, o se protegen con Vercel Authentication (incluido en Hobby y Pro).

## Hallazgo de numeración

Hay dos decisiones `0006`: `0006-correo-unico-canal.md` y `0006-esquema-base-de-datos-final.md`. Esta toma el número 0007 para no agregar otro choque. Conviene renumerar una de las dos en la tarea 1.9.

## Fuentes

Documentación oficial, consultada el 2026-11-05.

- **Vercel:** [precios](https://vercel.com/pricing), [precios en detalle](https://vercel.com/docs/pricing), [plan Hobby](https://vercel.com/docs/plans/hobby-plan), [Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn), [funciones por región](https://vercel.com/docs/functions/usage-and-pricing), [región de las funciones](https://vercel.com/docs/functions/configuring-functions/region), [Spend Management](https://vercel.com/docs/spend-management), [Cloudflare delante de Vercel](https://vercel.com/kb/guide/cloudflare-with-vercel) y [Next.js en Vercel frente a Cloudflare](https://vercel.com/kb/guide/next-js-on-vercel-vs-cloudflare.md).
- **Supabase:** [precios](https://supabase.com/pricing), [cómputo y disco](https://supabase.com/docs/guides/platform/compute-and-disk), [control de costos (Spend Cap)](https://supabase.com/docs/guides/platform/cost-control), [SMTP propio](https://supabase.com/docs/guides/auth/auth-smtp), [captcha](https://supabase.com/docs/guides/auth/auth-captcha) y [salida de Storage](https://supabase.com/docs/guides/storage/serving/bandwidth).
- **Amazon SES:** [precios](https://aws.amazon.com/ses/pricing/), [límites de envío](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html), [cuotas](https://docs.aws.amazon.com/ses/latest/dg/quotas.html) y [salida del sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).
- **Cloudflare:** [DNS](https://developers.cloudflare.com/dns/faq/), [Registrar](https://developers.cloudflare.com/registrar/), [Turnstile](https://developers.cloudflare.com/turnstile/plans/), [modos de Turnstile](https://developers.cloudflare.com/turnstile/concepts/widget/), [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Email Service](https://developers.cloudflare.com/email-service/platform/pricing/), [Next.js en Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) y [Next.js en Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/).
- **OpenNext:** [soporte de Next.js](https://opennext.js.org/cloudflare) y [versión 1.20.3 (`proxy.ts` experimental)](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/@opennextjs%2Fcloudflare@1.20.3).
- **Resend:** [precios](https://resend.com/pricing).
- **TRM:** [Noticias RCN, 3 de noviembre de 2026](https://www.noticiasrcn.com/economia/precio-del-dolar-en-colombia-hoy-3-de-noviembre-de-2026-1078003). No es fuente oficial; se recalcula con la TRM del Banco de la República del mes.
