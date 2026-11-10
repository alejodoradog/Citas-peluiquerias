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
- Reglas por carpeta en .claude/rules; skills `nueva-migracion`, `nueva-pantalla` y `cerrar-tarea`.
- Subagentes `revisor-spec` y `revisor-seguridad`, solo lectura: pásales la lista de archivos cambiados.
- Hooks en .claude/hooks: formateo y lint tras editar; typecheck y pruebas afectadas al terminar; bloqueo de .env* y de comandos remotos de Supabase y Vercel.
- MCP en .mcp.json: Supabase local (requiere Docker encendido), Playwright y GitHub (token en `GITHUB_PERSONAL_ACCESS_TOKEN`).

## Forma de trabajo
- Empieza en modo plan; espera aprobación antes de editar.
- Todo el trabajo va en la rama `desarrollo`, con commits convencionales por tarea; cada tarea termina con lint, typecheck y pruebas en verde.
- Un PR por hito (una fase de docs/plan.md): se abre en borrador `desarrollo` → `main` al empezar el hito, para que el CI corra en cada push, y se marca listo al cumplir su puerta de calidad. Se fusiona con "Create a merge commit", nunca squash, y el hito se cierra probando sus funciones en la URL desplegada.
- Marca las casillas de docs/*.md a medida que avanzas, en `desarrollo` y solo lo comprobado.
- Sin coautoría ni marcas de Claude en commits, PR ni archivos.
- Si la spec no responde algo, pregunta; no inventes reglas de negocio.