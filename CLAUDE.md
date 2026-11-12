# Barberías — agendamiento de citas (MVP)

SaaS multi-barbería para Colombia. Spec: @docs/spec.md. Tarea actual: docs/tareas/.

## Stack
Next.js (App Router) + TypeScript estricto + Tailwind, Supabase (Postgres, Auth, RLS),
Vercel, Vitest, Playwright, Zod, pnpm.

## Comandos
- pnpm dev | pnpm test | pnpm test:e2e | pnpm lint | pnpm typecheck
- pnpm supabase start | pnpm supabase db reset | pnpm supabase test db | pnpm db:types

## Reglas que no se rompen
- Toda tabla de negocio tiene barbershop_id y política RLS. Sin excepción.
- Las citas no se cruzan: lo garantiza un constraint en la base de datos.
- Fechas en UTC en BD; lógica y pantalla en America/Bogota vía src/lib/fechas.
- Dinero en pesos enteros (integer).
- Código en inglés; textos de interfaz en español de Colombia en src/ui/textos.ts.
- Reglas de negocio en src/modulos/*/dominio, puras y con pruebas.
- Nunca leer ni escribir .env* (excepción: .env.example, sin valores); nunca tocar el proyecto de producción.
- Infraestructura fija en docs/decisiones/0007-infraestructura.md: Vercel, Supabase, Amazon SES y Cloudflare solo para DNS y Turnstile. No agregar servicios de pago, servicios exclusivos de Vercel (@vercel/kv, blob, postgres, edge-config) ni correos por cita sin una decisión nueva.

## Configuración de Claude Code
- Reglas por carpeta en .claude/rules; skills `nueva-migracion`, `nueva-pantalla`, `cerrar-tarea` y `revisar-avance` (estado contra el plan y si se puede seguir).
- Subagentes `revisor-spec` y `revisor-seguridad`, solo lectura: pásales la lista de archivos cambiados.
- Hooks en .claude/hooks: formateo y lint tras editar; typecheck y pruebas afectadas al terminar; bloqueo de .env* y de comandos remotos de Supabase y Vercel.
- MCP en .mcp.json: Supabase local (requiere Docker encendido), Playwright y GitHub (token en `GITHUB_PERSONAL_ACCESS_TOKEN`).

## Forma de trabajo
- Empieza en modo plan; espera aprobación antes de editar.
- Dos personas trabajan en paralelo, cada una con su Claude Code: antes de empezar una tarea, lee `docs/trabajo-en-paralelo.md` (quién hace qué y cómo no pisarse).
- Una rama por tarea, creada desde `main` actualizado: `hito-<fase>-<tema>` para tareas del plan, `docs-<tema>` o `ci-<tema>` para lo demás. Commits convencionales que terminan en `(tarea N.N)`; cada tarea termina con lint, typecheck y pruebas en verde.
- Un PR por tarea hacia `main`: se abre en borrador con el primer push, para que el CI corra en cada push, y se marca listo con el CI en verde. Para ponerse al día con `main` se mete `main` en la rama ("Update branch" o merge), sin rebase.
- Solo la cuenta `alejodoradog` fusiona, con "Create a merge commit", nunca squash: en Vercel Hobby solo despliegan sus commits. La rama se borra al fusionar.
- Marca las casillas de docs/*.md solo con lo comprobado: la casilla de una tarea del plan, cuando se verificó en la URL desplegada.
- Sin coautoría ni marcas de Claude en commits, PR ni archivos.
- Si la spec no responde algo, pregunta; no inventes reglas de negocio.