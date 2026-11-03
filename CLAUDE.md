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