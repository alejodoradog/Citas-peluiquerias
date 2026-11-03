---
name: nueva-migracion
description: Crea una tabla o un cambio de base de datos con RLS, índices, prueba de seguridad y tipos regenerados. Úsala para cualquier cambio en supabase/migrations.
---

# Nueva migración

1. Confirma en `docs/spec.md` y en la tarea qué pide el cambio. Si no lo responden, pregunta; no inventes reglas de negocio.
2. Crea el archivo con `pnpm supabase migration new <nombre_en_ingles>`. Nunca edites una migración ya aplicada.
3. Escribe la migración:
   - Toda tabla de negocio lleva `barbershop_id` y `enable row level security`, con políticas explícitas.
   - Fechas en `timestamptz` y en UTC; dinero en pesos enteros (`integer`).
   - Índices para las consultas previstas y para las columnas que usan las políticas.
   - Las reglas que deben cumplirse siempre, como que las citas no se crucen, van como constraint.
4. Escribe primero la prueba pgTAP en `supabase/tests` y mírala fallar. Debe demostrar que una barbería no puede leer ni escribir datos de otra.
5. Aplica y prueba con `pnpm supabase db reset` y `pnpm supabase test db`.
6. Regenera los tipos con `pnpm db:types`.
7. Corre `pnpm lint`, `pnpm typecheck` y `pnpm test`.

Solo trabaja contra Supabase local. Nunca apliques migraciones a un proyecto remoto.
