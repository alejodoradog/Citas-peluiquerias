# Plan de desarrollo con Claude Code — Agendamiento para barberías

Nov 2, 2026 · @Alejandro

## Resumen

El MVP se construye en 7 fases cortas (unas 6 semanas) con Claude Code escribiendo el código, tú como dueño del producto y del diseño, y esta conversación como espacio de arquitectura y revisión. La especificación del MVP es la fuente de verdad: todo lo que Claude Code construye sale de ella, y si algo cambia, se cambia primero ahí.

**Reparto de roles**

| Quién | Qué hace | Qué no hace |
| --- | --- | --- |
| Tú | Decides qué se construye y en qué orden, apruebas cada plan, pruebas en tu celular, diseñas pantallas, haces el merge | No escribes código a mano salvo ajustes mínimos |
| Claude (aquí) | Arquitectura, revisión de planes y decisiones difíciles, diseño de pantallas, actualizar la especificación | No toca el repositorio |
| Claude Code | Planifica cada tarea, escribe código, migraciones y pruebas, corre los chequeos, abre el pull request | No decide alcance ni cambia la especificación por su cuenta |

**Tres reglas que hacen que esto salga bien hecho y rápido:**

1. Una tarea pequeña por sesión, siempre empezando en modo plan y terminando con pruebas que pasan.
2. Nada llega a `main` sin pull request, revisión y chequeos automáticos en verde.
3. Las reglas críticas (datos separados por barbería, horas que no se cruzan, hora de Colombia) se protegen en la base de datos y con pruebas, no solo en el código.

## Decisiones de arquitectura

Una sola aplicación web (un "monolito modular") sobre servicios administrados es lo que permite llegar rápido sin deuda: nada de microservicios ni servidores propios, pero con módulos bien separados que se pueden extraer si algún día hace falta.

&#91;embedded content: arquitectura del MVP · 4 tipos de usuario, 1 app, 1 base de datos, 3 servicios externos\]

Las cuatro clases de usuario entran a la misma app; las reglas que no pueden fallar viven en la base de datos, y las tareas programadas envían los mensajes.

| Decisión | Elección | Por qué |
| --- | --- | --- |
| Separación de barberías | Una sola base de datos, `barbershop_id` en todo y Row Level Security | Aunque el código tenga un error, la base de datos no entrega datos de otra barbería |
| Citas que no se cruzan | Constraint de exclusión de PostgreSQL sobre rango de tiempo por barbero | Dos reservas simultáneas a la misma hora: una entra y la otra falla, siempre |
| Lógica de negocio | Funciones puras en `modulos/*/dominio`, sin base de datos | Se prueban en milisegundos y Claude Code no las rompe sin que una prueba lo note |
| Escrituras | Server Actions de Next.js, validadas con Zod | Menos código que una API aparte; la API pública llega solo si hace falta |
| Mensajes | Solo por correo, con tabla de cola + tarea programada cada minuto (decisión 0006) | Si el envío falla, se reintenta; nunca se envía dos veces el mismo mensaje |
| Hora | UTC en base de datos, `America/Bogota` en lógica y pantalla | Colombia no cambia de hora, pero el servidor sí puede estar en otra zona |
| Acceso del barbero | Link con token aleatorio guardado como hash, revocable | Sin cuentas ni contraseñas, y seguro si el barbero se va |

Cada decisión se guarda como un archivo corto en `docs/decisiones/` para que Claude Code (y cualquier desarrollador futuro) entienda el porqué.

## Estructura del repositorio y convenciones

Un solo repositorio con una sola app de Next.js, organizado por módulos de negocio (no por tipo de archivo), para que cada módulo se pueda entender y cambiar sin tocar los demás.

```text
barberias/
├── CLAUDE.md                  # Reglas del proyecto para Claude Code (corto)
├── docs/
│   ├── spec.md                # Especificación del MVP (copia del documento)
│   ├── decisiones/            # Un archivo por decisión de arquitectura (ADR)
│   └── tareas/                # Un archivo por tarea con criterios de aceptación
├── .claude/
│   ├── settings.json          # Permisos y hooks compartidos
│   ├── rules/                 # Reglas por carpeta (ej. reglas de migraciones)
│   ├── skills/                # Procedimientos del proyecto
│   └── agents/                # Subagentes de revisión
├── supabase/
│   ├── migrations/            # Cambios de base de datos, en orden
│   ├── seed.sql               # Datos de prueba (2 barberías, 4 barberos)
│   └── tests/                 # Pruebas de seguridad por fila (RLS)
├── src/
│   ├── app/
│   │   ├── (publico)/[slug]/  # Página de reservas del cliente
│   │   ├── (panel)/panel/     # Panel del dueño
│   │   ├── (barbero)/b/[token]/ # Vista "Mi agenda" por link privado
│   │   └── (admin)/admin/     # Panel de plataforma
│   ├── modulos/
│   │   ├── barberias/         # Registro, configuración, horarios
│   │   ├── agenda/            # Motor de disponibilidad y citas
│   │   ├── clientes/
│   │   ├── notificaciones/    # Plantillas, cola y envío por correo
│   │   └── suscripciones/     # Planes, pagos, estados
│   ├── ui/                    # Componentes visuales compartidos
│   └── lib/                   # Supabase, fechas, validación, utilidades
└── tests/e2e/                 # Pruebas de punta a punta de los 3 flujos
```

**Convenciones**

- **Código en inglés, interfaz en español.** Nombres de variables, funciones y tablas en inglés (es el idioma en que mejor trabaja cualquier herramienta y cualquier desarrollador que contrates después); textos de pantalla en español de Colombia, todos en un solo archivo de textos.
- **Cada módulo tiene tres capas:** `dominio` (reglas puras, sin base de datos, 100% probadas), `datos` (consultas a Supabase) y `acciones` (Server Actions que usa la interfaz).
- **Validación con Zod** en toda entrada del usuario, tanto en el cliente como en el servidor.
- **Fechas:** se guardan en UTC, se calculan y muestran en `America/Bogota` con una sola utilidad de fechas; prohibido `new Date()` suelto en lógica de negocio.
- **Dinero:** pesos enteros (`integer`), nunca decimales.
- **Commits** en formato convencional (`feat:`, `fix:`, `chore:`), rama `desarrollo` y un PR por fase (desde el 2026-11-07; antes, ramas `fase-N/tarea-corta`).

Nota: la especificación nombra las tablas en español; en el código se usan sus equivalentes en inglés (`barbershops`, `barbers`, `appointments`…), con el glosario en `docs/decisiones/0001-modelo-de-datos.md`.

## Preparación del entorno

Todo se prepara en una tarde; ninguna cuenta cuesta dinero al inicio salvo tu suscripción de Claude.

**Cuentas**

- [x] Plan de Claude con Claude Code (Pro sirve para empezar; Max si vas a trabajar muchas horas al día).
- [x] GitHub: repositorio `Citas-peluiquerias` (el nombre `barberias` queda pendiente).
- [ ] Supabase: dos proyectos, `barberias-dev` (organización gratis) y `barberias-prod` (organización Pro, `us-east-1`, se crea en la 6.4). `barberias-dev` ya existe; falta conectarlo a Vercel (`docs/operacion/configurar-barberias-dev.md`).
- [x] Vercel: conectado al repositorio de GitHub. Sigue en Hobby hasta la 6.4, cuando pasa a Pro (decisión 0007).
- [ ] Cloudflare: cuenta gratis, solo para el DNS del dominio y Turnstile (decisión 0007, `docs/operacion/infraestructura-produccion.md`).
- [ ] AWS: cuenta para Amazon SES en `us-east-1`, con permiso de Amazon para enviar a cualquier correo (antes de la tarea 5.2).
- [ ] Dominio propio: remitente verificado para SES (antes de la tarea 5.2).
- [ ] Sentry: plan gratis, para errores.

**Herramientas en tu computador (Windows)**

- [x] Git for Windows (Claude Code lo usa como terminal).
- [x] Node.js LTS y pnpm.
- [x] Docker Desktop (para correr Supabase en tu computador).
- [x] Supabase CLI.
- [ ] Antigravity IDE como editor. Claude Code corre en su terminal integrada con el comando `claude`; si la extensión de Claude Code aparece en su tienda de extensiones, también sirve. Deja apagado o solo en modo lectura el agente propio de Antigravity en este proyecto, para que dos agentes no editen los mismos archivos.
- [x] Claude Code. En PowerShell: `irm https://claude.ai/install.ps1 | iex`, luego abre una terminal nueva y verifica con `claude --version` ([guía oficial](https://code.claude.com/docs/en/quickstart.md)).

**Primer arranque**

1. Crea la carpeta del proyecto, ábrela en Antigravity, abre su terminal integrada y ejecuta `claude`; inicia sesión con tu cuenta de Claude.
2. Copia la especificación del MVP a `docs/spec.md` (exporta el documento a Markdown).
3. Crea `CLAUDE.md` con el contenido de la sección siguiente.
4. Pide a Claude Code la tarea 0.1 del plan por fases.

## Configurar Claude Code

La configuración convierte las reglas del proyecto en algo que Claude Code no puede olvidar: `CLAUDE.md` le dice qué es el proyecto, las skills le enseñan procedimientos, los hooks hacen cumplir los chequeos y los subagentes revisan con ojos frescos. La [guía de buenas prácticas](https://code.claude.com/docs/en/best-practices.md) recomienda mantener `CLAUDE.md` corto y mover los procedimientos a skills.

**CLAUDE.md inicial** (en la raíz del repositorio)

```markdown
# Barberías — agendamiento de citas (MVP)

SaaS multi-barbería para Colombia. Spec: @docs/spec.md. Tarea actual: docs/tareas/.

## Stack
Next.js (App Router) + TypeScript estricto + Tailwind, Supabase (Postgres, Auth, RLS),
Vercel, Vitest, Playwright, Zod, pnpm.

## Comandos
- pnpm dev | pnpm test | pnpm test:e2e | pnpm lint | pnpm typecheck
- supabase start | supabase db reset | supabase test db

## Reglas que no se rompen
- Toda tabla de negocio tiene barbershop_id y política RLS. Sin excepción.
- Las citas no se cruzan: lo garantiza un constraint en la base de datos.
- Fechas en UTC en BD; lógica y pantalla en America/Bogota vía src/lib/fechas.
- Dinero en pesos enteros (integer).
- Código en inglés; textos de interfaz en español de Colombia en src/ui/textos.ts.
- Reglas de negocio en src/modulos/*/dominio, puras y con pruebas.
- Nunca leer ni escribir .env*; nunca tocar el proyecto de producción.

## Forma de trabajo
- Empieza en modo plan; espera aprobación antes de editar.
- Una tarea por rama; termina con lint, typecheck y pruebas en verde.
- Si la spec no responde algo, pregunta; no inventes reglas de negocio.
```

**Reglas por carpeta** (`.claude/rules/`): una para `supabase/migrations` (nunca editar una migración ya aplicada, siempre agregar RLS y prueba) y otra para `src/app` (mobile-first, accesibilidad básica, textos desde el archivo de textos).

**Skills del proyecto** (`.claude/skills/`), que pides a Claude Code crear en la fase 0:

| Skill | Para qué |
| --- | --- |
| `nueva-migracion` | Crear tabla o cambio con RLS, índices, prueba de seguridad y tipos regenerados |
| `nueva-pantalla` | Crear pantalla mobile-first con estados de carga, vacío y error, y su prueba |
| `cerrar-tarea` | Correr todos los chequeos, revisar contra la spec, actualizar `docs/tareas` y abrir el PR |

**Plugins y skills ya disponibles**

| Herramienta | Uso en este proyecto |
| --- | --- |
| Skill `frontend-design` | Que las pantallas no se vean genéricas |
| Plugin Arxitect (revisión de arquitectura, API y diseño) | Revisar cada fase antes de cerrarla |
| Plugin Intuitive Software Design | Revisar los flujos de reserva y registro desde el punto de vista del usuario |
| Plugin `domain-driven-design` | Mantener los módulos separados por dominio |
| Plugin de seguridad oficial de Anthropic ([security-guidance](https://code.claude.com/docs/en/security-guidance.md)) | Revisar cada cambio buscando fallas de seguridad |

Los plugins de tu organización en claude.ai se pueden usar también en Claude Code ([cómo instalar plugins](https://code.claude.com/docs/en/plugins/install.md)).

**Servidores MCP** ([guía](https://code.claude.com/docs/en/mcp.md))

- Supabase: para que Claude Code consulte el esquema y los datos del proyecto **dev**, nunca el de producción.
- Playwright: para que Claude Code abra la app en un navegador y pruebe los flujos como lo haría un cliente.
- GitHub: para abrir pull requests y leer comentarios.

**Hooks** (`.claude/settings.json`, [guía](https://code.claude.com/docs/en/hooks-guide.md))

- Después de cada edición: formatear con Prettier y corregir con ESLint.
- Al terminar un turno (hook `Stop`): correr `typecheck` y las pruebas afectadas; si fallan, Claude Code sigue trabajando.
- Bloquear la lectura de archivos `.env*` y cualquier comando contra producción.

**Subagentes** (`.claude/agents/`)

- `revisor-spec`: compara lo construido contra `docs/spec.md` y la tarea, y lista lo que falta o sobra.
- `revisor-seguridad`: revisa RLS, tokens de links, validación de entradas y fugas de datos entre barberías.

## Cómo trabajar cada tarea

Cada tarea es una sesión nueva de Claude Code que empieza en modo plan y termina en un pull request; tú apruebas dos veces: el plan antes del código y el resultado en tu celular antes del merge.

> **Desde el 2026-11-07, por hitos** (decisión del fundador): todo el trabajo va en la rama `desarrollo`, con commits por tarea. Cada fase de este plan es un hito con un solo PR `desarrollo` → `main`, abierto en borrador al empezar para que el CI corra en cada push. Se marca listo cuando el hito cumple su puerta de calidad, se fusiona con "Create a merge commit" (la cuenta dueña del proyecto en Vercel, para que despliegue) y el hito se cierra probando sus funciones en la URL desplegada. Las funciones P2 entran en el hito de su pantalla.

&#91;embedded content: ciclo de una tarea · 8 pasos, 2 aprobaciones tuyas\]

Cuando un chequeo falla, Claude Code corrige solo; cuando algo falla en tu celular, se escribe una tarea de ajuste en vez de parchar sobre la marcha.

**Buenas prácticas con Claude Code**

- **Modo plan siempre** (`Shift+Tab` cambia el modo de permisos). Lee el plan completo; si toca la base de datos, la seguridad o la estructura, tráelo aquí antes de aprobar.
- **Tareas pequeñas**: algo que se termine en una sesión, con un criterio de "lista cuando" claro. Si el plan pasa de 10 pasos, divídelo.
- **Dale cómo verificar**: pide siempre que escriba la prueba primero y que la vea fallar y luego pasar.
- **`/clear` entre tareas** para que no arrastre contexto viejo; lo permanente va en `CLAUDE.md` o en la spec, no en la conversación.
- **Corrige la causa, no el síntoma**: si Claude Code repite un error, agrega la regla a `CLAUDE.md` o a una regla de carpeta.
- **Revisión con otros ojos**: al cerrar cada fase, pídele que use el subagente `revisor-spec` y la revisión de arquitectura del plugin Arxitect.
- **No le pidas varias cosas a la vez** en la misma sesión; si quieres trabajo en paralelo, usa sesiones separadas en worktrees ([guía](https://code.claude.com/docs/en/worktrees.md)).

**Plantilla de tarea** (`docs/tareas/1.3-citas-sin-cruces.md`)

```markdown
# 1.3 Citas sin cruces
Objetivo: dos citas activas del mismo barbero nunca se solapan.
Spec: sección Reglas de negocio > Disponibilidad.
Lista cuando:
- Insertar dos citas solapadas falla en la BD (prueba pgTAP).
- Citas canceladas no bloquean el espacio.
- La acción de reservar muestra "Esa hora ya la tomaron" y no un error técnico.
Fuera de alcance: interfaz de la agenda.
```

## Plan por fases

Son 7 fases; cada una termina con algo que puedes abrir en tu celular y probar. No se empieza una fase sin cerrar la anterior con sus criterios en verde.

### Fase 0 · Fundaciones (2 a 3 días)

- [x] 0.1 Crear proyecto Next.js + TypeScript estricto + Tailwind + pnpm, con ESLint, Prettier, Vitest y Playwright configurados.
- [x] 0.2 Inicializar Supabase local, cliente de Supabase para servidor y navegador, tipos generados.
- [x] 0.3 Utilidad de fechas en `America/Bogota` con pruebas (cambio de día, medianoche, festivos).
- [x] 0.4 GitHub Actions: lint, typecheck, pruebas en cada pull request; despliegue de vista previa en Vercel.
- [x] 0.5 `CLAUDE.md`, reglas, skills `nueva-migracion`, `nueva-pantalla`, `cerrar-tarea`, subagentes y hooks.

**Lista cuando:** un pull request de prueba pasa todos los chequeos y se ve publicado en una URL de Vercel.

```text
Lee CLAUDE.md y docs/spec.md. Vamos con la tarea 0.1 del plan.
Entra en modo plan: propón la estructura y los comandos, y espera mi aprobación.
```

### Fase 1 · Base de datos, seguridad y acceso (semana 1)

- [x] 1.1 Migraciones de las tablas de la spec (11, más `barbershop_hours` y `holiday_openings`; ver `docs/decisiones/0001-modelo-de-datos.md`), con `barbershop_id`, índices y llaves foráneas.
- [x] 1.2 Políticas RLS: el dueño solo ve su barbería; el super admin ve todo; el público solo lee lo necesario para reservar.
- [x] 1.3 Constraint de exclusión en `appointments` para que dos citas activas del mismo barbero no se crucen.
- [x] 1.4 Registro e ingreso con correo y contraseña, recuperación por correo, rol super admin.
- [x] 1.5 Pruebas de RLS: un dueño intentando leer o escribir datos de otra barbería falla.
- [x] 1.6 Datos de prueba: 2 barberías, 4 barberos, servicios y citas.
- [x] 1.7 Base para la fase 2: convenciones de capas, formularios, errores y rutas, tras la revisión de arquitectura de cierre de fase (`docs/decisiones/0005-convenciones-de-codigo.md`).
- [x] 1.8 Correo como único canal: sin WhatsApp como canal de mensajes y sin códigos OTP; correo del cliente y del barbero, y confirmación del correo del dueño con un link (`docs/decisiones/0006-correo-unico-canal.md`).
- [x] 1.9 Esquema final de la base de datos (`docs/decisiones/0006-esquema-base-de-datos-final.md`, `docs/tareas/1.9-esquema-final.md`): varias sedes por cuenta (`memberships`), varios servicios por cita (`appointment_services`), historial de citas, horarios sin cruces, barberos dados de baja, correo obligatorio en la reserva web y plan único. Migraciones 2 a 8 del anexo A.
- [x] 1.10 Infraestructura base: región `iad1` fija en `vercel.json`, lint que prohíbe los servicios exclusivos de Vercel y región de `barberias-dev` documentada (`docs/decisiones/0007-infraestructura.md`, `docs/tareas/1.10-infraestructura-base.md`).

**Lista cuando:** `supabase test db` pasa, y entrar como dueño de la barbería A nunca muestra nada de la B.

### Fase 2 · Configuración de la barbería (semana 2)

- [x] 2.0 Sistema de diseño: tokens y componentes de "Fundamentos" (F-01) del canvas "Prototipos Barberías" en Claude Design, con la marca Yapoin, y ajuste de las pantallas de cuentas (D-01 a D-09) a ese sistema.
- [x] 2.1 Asistente de registro: pasos 2 y 3 (servicios sugeridos → barberos y horarios, con "Yo también corto"). El paso 1 y la prueba gratis de 20 días se hicieron en la 1.4.
- [x] 2.2 CRUD de servicios (precio en COP, duración) y de barberos (foto en Supabase Storage con URL firmada de subida, correo opcional, avisos por correo, horario semanal, servicios que hace).
- [x] 2.3 Link privado por barbero: generar, copiar o enviar por correo si el barbero tiene uno, desactivar y regenerar. (El envío por correo pasa a la 5.2, con SES; ver docs/tareas/2.3-link-privado.md.)
- [ ] 2.4 Configuración: horario de la barbería, festivos de Colombia precargados, cierres especiales, políticas de anticipación y cancelación, WhatsApp de contacto y cambio de link con advertencia. Los datos de abono son P2 en la spec y quedan para después del lanzamiento. Construida (2.4a a 2.4e); pendiente del CI: pgTAP, tipos generados y pruebas de punta a punta (docs/tareas/2.4-configuracion.md).
- [x] 2.5 Pantalla Compartir: link público, QR descargable y texto para estados.
- [ ] 2.6 Datos de abono (P2, D-63) y selector de sede con "Nueva sede" (`create_barbershop`, decisión 0006).

**Lista cuando:** creas una barbería real desde tu celular en menos de 10 minutos.

### Fase 3 · Motor de disponibilidad y página pública (semana 3)

- [ ] 3.1 Motor de disponibilidad como función pura en `modulos/agenda/dominio`, con pruebas de todos los casos de la spec (bloqueos, festivos, duración, anticipación, "el primero disponible").
- [ ] 3.2 Página pública: perfil con link al WhatsApp de la barbería, servicios (uno o varios), barbero, día y hora, datos (nombre, correo y celular opcional; autocompletar solo desde el navegador) y confirmación. El perfil público va en caché corta; la disponibilidad y la reserva, siempre en vivo.
- [ ] 3.3 Confirmar cita con validación final en la base de datos; si otro tomó la hora, volver a elegir. Una reserva pública no sobrescribe la ficha de un cliente existente.
- [ ] 3.4 Gestionar mi cita con token: ver, cancelar, reprogramar según la política.
- [ ] 3.5 Protección contra abuso: límite de reservas por correo e IP, y verificación anti-bots invisible. Sin OTP, cualquiera puede escribir un correo ajeno (decisión 0006). Cubre también registro, ingreso, recuperación y reenvío de links, con captcha en Auth y límite por IP real, porque Auth solo ve la IP del servidor. Según la decisión 0007: Turnstile en modo Managed, captcha de Supabase Auth con Turnstile, límites propios con la IP que entrega Vercel y Vercel WAF para bloquear.

**Lista cuando:** reservas desde otro celular en menos de un minuto, y dos reservas simultáneas a la misma hora dejan solo una.

### Fase 4 · Agenda del panel y vista del barbero (semana 4)

- [ ] 4.1 Agenda día (columnas por barbero) y semana; tocar un espacio crea cita.
- [ ] 4.2 Cita manual con uno o varios servicios (`create_appointment`, avisando que sin correo no hay confirmación ni recordatorio), cambio de servicios de una cita (`change_appointment_services`), reprogramar, bloqueos de horas, cambio de estado (atendida, no asistió, cancelada).
- [ ] 4.3 Clientes: lista, búsqueda, ficha con historial y alerta de inasistencias, y borrar un cliente anonimizando sus datos (Ley 1581).
- [ ] 4.4 Vista "Mi agenda" del barbero por link privado, con permisos limitados.
- [ ] 4.5 Actualización de la agenda cuando entra una reserva, consultando cada 30–60 s en la vista de hoy, sin Realtime (decisión 0007).
- [ ] 4.6 Cierre del día (P2, D-64): servicios atendidos, total y comisión por barbero.

**Lista cuando:** el dueño maneja un día completo de trabajo solo desde el panel, y el barbero ve sus citas desde su link.

### Fase 5 · Notificaciones y suscripciones (semana 5)

- [ ] 5.1 Cola de notificaciones en BD y tarea programada que la procesa, sin envíos duplicados: pg_cron cada minuto y una Edge Function que envía por SES (decisión 0007). Incluye la migración 11 de la decisión 0006 (`add_notification_retention`, purga a los 90 días).
- [ ] 5.2 Envío por correo con Amazon SES, aislado en un solo módulo: plantillas en español, dominio verificado (SPF, DKIM, DMARC), rebotes y quejas, y correos de Auth por el mismo remitente. SES en `us-east-1`, plan Essentials, una llamada por destinatario y lista de supresión (decisión 0007).
- [ ] 5.3 Recordatorio 24 h (o 3 h) con links Confirmo / Cancelar que piden un toque, con un campo para guardar la respuesta, agregar al calendario y avisos opcionales al barbero. Presupuesto de la decisión 0007: 2 correos por cita, uno al cliente y uno al barbero; esta tarea decide cuál recibe el cliente (decisión abierta 2).
- [ ] 5.4 Panel de plataforma: lista de barberías, ficha, "Registrar pago y activar hasta", anular un pago con rastro, suspender, Reactivar, extender prueba y métricas (P2, P-06). Incluye la migración 9 de la decisión 0006 (`add_subscription_payment_flow`) y la copia en TypeScript de la fórmula de fechas, con una prueba que compare las dos.
- [ ] 5.5 Ciclo de suscripción automático: avisos de vencimiento, gracia de 5 días, suspensión suave, reactivación y limpieza de cuentas sin confirmar, que apartan su link (el plazo se define en esta tarea). Incluye la migración 10 de la decisión 0006 (`read_only_when_suspended`), los avisos en la agenda (D-70 a D-72, sin pantalla de suscripción) y Mis citas (P2, C-19 a C-21).

**Lista cuando:** una cita de prueba recibe confirmación y recordatorio reales por correo, que llegan a la bandeja de entrada de Gmail y Outlook, y una barbería vencida se suspende y se reactiva al registrar el pago.

### Fase 6 · Pulido y salida al piloto (semana 6)

- [ ] 6.1 Pruebas de punta a punta con Playwright de los 3 flujos de la spec.
- [ ] 6.2 Prueba en celulares reales (Android de gama media, iPhone) y redes lentas.
- [ ] 6.3 PWA instalable, ícono, nombre, pantalla sin conexión.
- [ ] 6.4 Proyecto de producción en Supabase con "Confirm email" y "Secure password change" activados, código de 10 caracteres y sus plantillas, dominio conectado a la app, Sentry, copias de seguridad. Según la decisión 0007 y `docs/operacion/infraestructura-produccion.md`: Supabase Pro en `us-east-1`, Vercel Pro en `iad1`, dominio con DNS en Cloudflare ("DNS only"), alertas de gasto sin pausar producción, migraciones y despliegue desde CI, monitor de disponibilidad, `pg_dump` semanal a S3 y simulacro de restauración. Variables de Production nuevas, apuntando a `barberias-prod`, con el tipo y las reglas de seguridad de `docs/operacion/infraestructura-produccion.md` ("Variables de producción en Vercel"); las de Preview no se reutilizan.
- [ ] 6.5 Términos de uso y política de datos personales visibles en el registro y la reserva.
- [ ] 6.6 Cargar las 10 barberías piloto.

**Lista cuando:** se cumple la compuerta de la spec: los 3 flujos funcionan sin errores en celular.

## Calidad, seguridad y despliegue

La prueba de fuego del producto es que una barbería nunca vea datos de otra y que nunca se agenden dos clientes a la misma hora; ambas cosas se prueban de forma automática en cada cambio.

**Pruebas**

| Tipo | Qué cubre | Herramienta | Cuándo corre |
| --- | --- | --- | --- |
| Unitarias | Motor de disponibilidad, fechas, ciclo de suscripción, cálculo de vencimientos | Vitest | Cada edición (hook) y cada PR |
| Base de datos | RLS entre barberías, constraint de citas cruzadas, permisos del público | pgTAP vía `supabase test db` | Cada PR que toca migraciones |
| Punta a punta | Reserva del cliente, registro de barbería, cobro y activación | Playwright | Cada PR a `main` |
| Manual | Celular real, red lenta, textos y diseño | Tú | Al cerrar cada fase |

**Seguridad**

- Los tokens de links (barbero y gestión de cita) son largos y aleatorios, se guardan como hash (nunca el valor original) y se pueden revocar.
- La página pública no expone correos, celulares ni nombres de otros clientes; solo horas libres.
- La clave de servicio de Supabase solo existe en el servidor; nunca en el navegador.
- Límite de solicitudes en la página pública y en el ingreso.
- Datos personales según la Ley 1581 de 2012: aviso de privacidad al reservar, opción de borrar un cliente.

**Ambientes y despliegue**

| Ambiente | Base de datos | Web | Uso |
| --- | --- | --- | --- |
| Local | Supabase en Docker | `pnpm dev` | Donde trabaja Claude Code |
| Vista previa | `barberias-dev` | URL de Vercel por cada PR | Donde pruebas tú desde el celular |
| Producción | `barberias-prod` | Tu dominio, en Vercel Pro | Barberías reales (desde la fase 6) |

El detalle de la infraestructura (hosting, imágenes, correo, anti-abuso, secretos, costos y cuándo escalar) está en `docs/decisiones/0007-infraestructura.md`, y el paso a paso de las cuentas en `docs/operacion/infraestructura-produccion.md`.

Las migraciones llegan a producción solo desde GitHub Actions al hacer merge a `main`, nunca desde la computadora. Supabase hace copias de seguridad diarias en el plan Pro, que se activa antes del piloto.

**Operación**

- Sentry avisa de errores en tu correo.
- Cada mes, las facturas se comparan con los costos de la decisión 0007 y se revisan sus umbrales de "Cuándo escalar o revisar".
- Un registro de cada mensaje enviado (o fallido) en la tabla de notificaciones.
- Revisión semanal con Claude (aquí) de errores, métricas del piloto y próximos cambios.

## Tus próximos pasos esta semana

El objetivo de esta semana es cerrar la fase 0 y arrancar la 1; todo lo demás puede esperar.

- [ ] Crear las cuentas y preparar tu computador (sección Preparación del entorno).
- [x] Exportar la especificación del MVP a Markdown y guardarla como `docs/spec.md`.
- [x] Elegir un nombre provisional para el repositorio y el producto (se puede cambiar después): el producto es Yapoin, con dominio `yapoin.com`.
- [x] Iniciar Claude Code en la carpeta y pedir la tarea 0.1 con el prompt de la fase 0.
- [ ] Traer aquí el plan que proponga Claude Code para la fase 1 (el modelo de datos) antes de aprobarlo: es la decisión más difícil de cambiar después.
- [ ] En paralelo, empezar el diseño de las 3 pantallas clave (reserva, agenda, registro); lo trabajamos juntos aquí.
- [ ] Comprar el dominio, crear la cuenta de AWS y solicitar el permiso de Amazon SES, para no frenar la fase 5.
