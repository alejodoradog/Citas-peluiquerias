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

## Configuración de Claude Code
- Reglas por carpeta en .claude/rules; skills `nueva-migracion`, `nueva-pantalla` y `cerrar-tarea`.
- Subagentes `revisor-spec` y `revisor-seguridad`, solo lectura: pásales la lista de archivos cambiados.
- Hooks en .claude/hooks: formateo y lint tras editar; typecheck y pruebas afectadas al terminar; bloqueo de .env* y de comandos remotos de Supabase y Vercel.
- MCP en .mcp.json: Supabase local (requiere Docker encendido), Playwright y GitHub (token en `GITHUB_PERSONAL_ACCESS_TOKEN`).

## Forma de trabajo
- Empieza en modo plan; espera aprobación antes de editar.
- Una tarea por rama; termina con lint, typecheck y pruebas en verde.
- Si la spec no responde algo, pregunta; no inventes reglas de negocio.